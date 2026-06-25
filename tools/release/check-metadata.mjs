import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

const releasePackages = [
	{
		name: "docklands",
		path: "apps/docklands/package.json",
		workspace: "apps/docklands",
	},
	{
		name: "docs",
		path: "apps/docs/package.json",
		workspace: "apps/docs",
	},
	{
		name: "site",
		path: "apps/site/package.json",
		workspace: "apps/site",
	},
];

const failures = [];

const readJson = (path) => {
	const absolutePath = resolve(root, path);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const packageVersions = new Map();
for (const pkg of releasePackages) {
	const manifest = readJson(pkg.path);
	if (manifest.name !== pkg.name) {
		failures.push(
			`${pkg.path} has package name ${manifest.name}; expected ${pkg.name}`,
		);
	}
	packageVersions.set(pkg.path, manifest.version);
}

const releaseVersion = packageVersions.get("apps/docklands/package.json");
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(releaseVersion)) {
	failures.push(
		`apps/docklands/package.json version must be plain semver, got ${releaseVersion}`,
	);
}

for (const pkg of releasePackages) {
	const version = packageVersions.get(pkg.path);
	if (version !== releaseVersion) {
		failures.push(
			`${pkg.path} version ${version} does not match release version ${releaseVersion}`,
		);
	}
}

const lockPath = resolve(root, "bun.lock");
const lockText = readFileSync(lockPath, "utf8");
for (const pkg of releasePackages) {
	const pattern = new RegExp(
		`"${escapeRegExp(pkg.workspace)}": \\{[\\s\\S]*?"name": "${escapeRegExp(
			pkg.name,
		)}",[\\s\\S]*?"version": "([^"]+)"`,
	);
	const match = lockText.match(pattern);
	if (!match) {
		failures.push(`bun.lock is missing workspace metadata for ${pkg.workspace}`);
		continue;
	}

	const lockVersion = match[1];
	const manifestVersion = packageVersions.get(pkg.path);
	if (lockVersion !== manifestVersion) {
		failures.push(
			`bun.lock ${pkg.workspace} version ${lockVersion} does not match ${relative(
				root,
				resolve(root, pkg.path),
			)} version ${manifestVersion}`,
		);
	}
}

if (failures.length > 0) {
	console.error("[release-metadata] Release metadata mismatch:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(`[release-metadata] Release metadata is aligned at ${releaseVersion}.`);
