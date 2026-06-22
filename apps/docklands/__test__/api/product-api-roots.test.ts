import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = new URL("../../", import.meta.url);

const collectSources = (relativeDir: string): string[] => {
	const dir = new URL(relativeDir, appRoot);
	const files: string[] = [];

	for (const entry of readdirSync(dir)) {
		const path = join(dir.pathname, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) {
			files.push(...collectSources(`${relativeDir}/${entry}`));
			continue;
		}

		if (/\.(ts|tsx)$/.test(entry)) {
			files.push(path);
		}
	}

	return files;
};

describe("product API roots", () => {
	it("keeps frontend callers on workspace and runtime-worker roots", () => {
		const sourceFiles = [
			...collectSources("app"),
			...collectSources("components"),
			...collectSources("client"),
			...collectSources("shared"),
		];

		expect(sourceFiles.length).toBeGreaterThan(0);
		let combinedSource = "";

		for (const file of sourceFiles) {
			const source = readFileSync(file, "utf8");
			combinedSource += source;
			expect(source, file).not.toContain("api.project.");
			expect(source, file).not.toContain("api.server.");
			expect(source, file).not.toContain("utils.project.");
			expect(source, file).not.toContain("utils.server.");
		}

		expect(combinedSource).toContain("api.workspaces.");
		expect(combinedSource).toContain("api.workspaceGraph.");
		expect(combinedSource).toContain("api.runtimeWorker.");
	});
});
