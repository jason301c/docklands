import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const targets = [
	"docs/FEATURES.md",
	"docs/RELEASE_NOTES.md",
	"apps/docs/src/content/docs",
	"apps/site/components",
	"apps/site/lib",
].map((path) => resolve(root, path));

const forbidden = [
	{
		pattern: /\/dashboard\/automations/,
		reason: "standalone automations are not shipped in v0.1.0",
	},
	{
		pattern: /Authorization:\s*Bearer/i,
		reason: "Docklands API keys use the x-api-key header",
	},
	{
		pattern: /reset-2fa/i,
		reason: "there is no authenticator reset entrypoint",
	},
	{
		pattern: /\bTOTP\b/i,
		reason: "Docklands uses passkeys, not authenticator-app codes",
	},
	{
		pattern: /\b2FA\b/i,
		reason: "Docklands uses passkeys, not authenticator-app codes",
	},
	{
		pattern: /two-factor authentication/i,
		reason: "Docklands uses passkeys, not authenticator-app codes",
	},
	{
		pattern: /twoFactor\(/,
		reason: "the Better Auth twoFactor plugin is not registered",
	},
	{
		pattern: /GitHub, GitLab, Bitbucket,\s*or Gitea\), because they are driven by pull-request webhooks/,
		reason: "preview deployments are GitHub-only in v0.1.0",
	},
	{
		pattern: /## Creating an organization/,
		reason: "Docklands has one instance organization",
	},
	{
		pattern: /## Switching the active organization/,
		reason: "Docklands has one instance organization",
	},
	{
		pattern: /schedule\.ts/,
		reason: "the standalone schedule router/schema is not shipped",
	},
	{
		pattern: /schedule\.create/,
		reason: "the standalone schedule router/schema is not shipped",
	},
	{
		pattern: /auditLog · schedule/,
		reason: "the standalone schedule router/schema is not shipped",
	},
	{
		pattern: /libSQL case is uneven/i,
		reason: "libSQL logical backups are not exposed; use volume backups",
	},
	{
		pattern: /backup form will let you create a libSQL/i,
		reason: "libSQL logical backups are not exposed; use volume backups",
	},
];

const textExtensions = new Set([".md", ".mdx", ".ts", ".tsx"]);

const walk = async (path) => {
	const { readdir, stat } = await import("node:fs/promises");
	const info = await stat(path);
	if (info.isFile()) return [path];

	const entries = await readdir(path, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const child = resolve(path, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(child)));
		} else if (entry.isFile()) {
			files.push(child);
		}
	}
	return files;
};

const hasTextExtension = (path) => {
	const idx = path.lastIndexOf(".");
	return idx !== -1 && textExtensions.has(path.slice(idx));
};

const failures = [];
const files = (await Promise.all(targets.map(walk)))
	.flat()
	.filter(hasTextExtension);

for (const file of files) {
	const text = readFileSync(file, "utf8");
	const lines = text.split(/\r?\n/);
	for (const { pattern, reason } of forbidden) {
		for (let index = 0; index < lines.length; index++) {
			if (!pattern.test(lines[index])) continue;
			failures.push({
				file,
				line: index + 1,
				reason,
				text: lines[index].trim(),
			});
		}
	}
}

if (failures.length > 0) {
	console.error("[docs-current] Stale public-docs claims found:");
	for (const failure of failures) {
		console.error(
			`- ${relative(root, failure.file)}:${failure.line}: ${failure.reason}`,
		);
		console.error(`  ${failure.text}`);
	}
	process.exit(1);
}

console.log("[docs-current] Public docs stale-claim scan passed.");
