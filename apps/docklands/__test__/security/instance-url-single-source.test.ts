import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The instance URL has exactly one producer: `server/core/services/instance-url.ts`
 * (mirrored to clients via `settings.getInstanceUrl`). If any other file
 * reconstructs the instance URL from `window.location`, the `BETTER_AUTH_URL`/
 * `PUBLIC_URL` env, or the removed `getDocklandsUrl` helper, the two sources can
 * drift apart again. This test fails the build when that happens — it is the
 * mechanical guarantee behind "single source of truth", not a convention.
 */

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const SCAN_DIRS = ["server", "client", "components", "app", "shared"];
const SKIP_DIRS = new Set([
	"node_modules",
	".next",
	"dist",
	"drizzle",
	"templates",
	"public",
	"__test__",
]);

// Files allowed to reference each otherwise-forbidden token, by app-relative path.
const ALLOW = {
	// The single sanctioned client-side window.location fallback (loading state).
	windowLocationOrigin: new Set(["client/hooks/use-url.ts"]),
	// The single source of truth + Better Auth's lazy config builder are the only
	// readers of the instance-URL env channel.
	instanceUrlEnv: new Set([
		"server/core/services/instance-url.ts",
		"server/core/lib/auth.ts",
	]),
};

const collectSourceFiles = (): string[] => {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) {
				if (!SKIP_DIRS.has(entry)) walk(full);
				continue;
			}
			if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
				out.push(full);
			}
		}
	};
	for (const dir of SCAN_DIRS) walk(join(APP_ROOT, dir));
	return out;
};

const rel = (file: string) => relative(APP_ROOT, file).replaceAll("\\", "/");

describe("instance URL single source of truth", () => {
	const files = collectSourceFiles().map((file) => ({
		path: rel(file),
		source: readFileSync(file, "utf8"),
	}));

	it("scans a non-trivial number of source files", () => {
		expect(files.length).toBeGreaterThan(100);
	});

	it("does not reconstruct the instance URL from window.location.origin", () => {
		const offenders = files
			.filter(
				(f) =>
					f.source.includes("window.location.origin") &&
					!ALLOW.windowLocationOrigin.has(f.path),
			)
			.map((f) => f.path);
		expect(
			offenders,
			`Build the instance URL via useUrl() / settings.getInstanceUrl, not window.location.origin: ${offenders.join(", ")}`,
		).toEqual([]);
	});

	it("does not read the instance-URL env outside the single source + auth", () => {
		const offenders = files
			.filter(
				(f) =>
					(f.source.includes("process.env.BETTER_AUTH_URL") ||
						f.source.includes("process.env.PUBLIC_URL")) &&
					!ALLOW.instanceUrlEnv.has(f.path),
			)
			.map((f) => f.path);
		expect(
			offenders,
			`Resolve the instance URL via instance-url.ts, not the env directly: ${offenders.join(", ")}`,
		).toEqual([]);
	});

	it("does not resurrect the removed getDocklandsUrl helper", () => {
		const offenders = files
			.filter((f) => f.source.includes("getDocklandsUrl"))
			.map((f) => f.path);
		expect(
			offenders,
			`getDocklandsUrl was replaced by getInstanceUrl: ${offenders.join(", ")}`,
		).toEqual([]);
	});

	it("keeps the single producer exporting the resolver API", () => {
		const source = readFileSync(
			join(APP_ROOT, "server/core/services/instance-url.ts"),
			"utf8",
		);
		expect(source).toContain("export const getInstanceUrl");
		expect(source).toContain("export const reconcileInstanceUrlEnv");
	});
});
