#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(toolsDir, "..");
const appRoot = join(workspaceRoot, "apps", "docklands");
const failures = [];

const readText = (path) => readFileSync(path, "utf8");
const readJson = (path) => JSON.parse(readText(path));
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const workspaceManifest = readJson(join(workspaceRoot, "package.json"));
const packageFiles = new Set([join(workspaceRoot, "package.json")]);

for (const workspacePattern of workspaceManifest.workspaces ?? []) {
	if (!workspacePattern.endsWith("/*")) {
		failures.push(
			`Unsupported workspace pattern "${workspacePattern}" in package.json; update tools/check-bundler.mjs before relying on it.`,
		);
		continue;
	}

	const workspaceDir = join(workspaceRoot, workspacePattern.slice(0, -2));
	if (!existsSync(workspaceDir)) {
		continue;
	}

	for (const entry of readdirSync(workspaceDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}

		const packageFile = join(workspaceDir, entry.name, "package.json");
		if (existsSync(packageFile)) {
			packageFiles.add(packageFile);
		}
	}
}

const webpackPackages = new Set([
	"@next/bundle-analyzer",
	"next-transpile-modules",
	"webpack",
	"webpack-bundle-analyzer",
	"webpack-cli",
	"webpack-dev-middleware",
	"webpack-dev-server",
]);

for (const packageFile of packageFiles) {
	const manifest = readJson(packageFile);
	const relativePackageFile = packageFile.replace(`${workspaceRoot}/`, "");

	for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
		if (/(^|\s)--webpack(\s|$)/.test(command)) {
			failures.push(
				`${relativePackageFile} script "${scriptName}" opts into Webpack with --webpack.`,
			);
		}
		if (/(^|\s)--turbo(\s|$)/.test(command)) {
			failures.push(
				`${relativePackageFile} script "${scriptName}" uses the legacy --turbo flag; use Next 16 Turbopack defaults or --turbopack.`,
			);
		}
	}

	for (const dependencyGroup of [
		"dependencies",
		"devDependencies",
		"optionalDependencies",
		"peerDependencies",
	]) {
		for (const dependencyName of Object.keys(manifest[dependencyGroup] ?? {})) {
			if (webpackPackages.has(dependencyName)) {
				failures.push(
					`${relativePackageFile} declares ${dependencyName} in ${dependencyGroup}; Docklands should not carry Webpack tooling.`,
				);
			}
		}
	}
}

const lockfilePath = join(workspaceRoot, "bun.lock");
if (existsSync(lockfilePath)) {
	const lockfile = readText(lockfilePath);
	for (const packageName of webpackPackages) {
		const packagePattern = escapeRegExp(packageName);
		const lockfilePackagePattern = new RegExp(
			`^\\s*"${packagePattern}(?:@npm:[^"]*)?"\\s*:`,
			"m",
		);

		if (lockfilePackagePattern.test(lockfile)) {
			failures.push(
				`bun.lock contains ${packageName}; remove Webpack tooling from the dependency graph.`,
			);
		}
	}
}

const nextConfigPath = join(appRoot, "next.config.mjs");
const nextConfig = readText(nextConfigPath);

if (!/\bturbopack\s*:\s*\{/.test(nextConfig)) {
	failures.push(
		"apps/docklands/next.config.mjs must keep top-level turbopack config for Next 16.",
	);
}

if (/\bwebpack\s*[:(]/.test(nextConfig)) {
	failures.push(
		"apps/docklands/next.config.mjs must not define custom Webpack config.",
	);
}

if (/\bexperimental\s*:\s*\{[^}]*\bturbo\s*:/s.test(nextConfig)) {
	failures.push(
		"apps/docklands/next.config.mjs must use top-level turbopack config, not experimental.turbo.",
	);
}

const customServerPath = join(appRoot, "server", "server.ts");
const customServer = readText(customServerPath);

if (!/\bturbopack\s*:\s*true\b/.test(customServer)) {
	failures.push(
		"apps/docklands/server/server.ts must pass turbopack: true to the custom Next server.",
	);
}

if (/\bwebpack\s*:\s*true\b/.test(customServer)) {
	failures.push(
		"apps/docklands/server/server.ts must not pass webpack: true to the custom Next server.",
	);
}

if (failures.length > 0) {
	console.error("[bundler-check] Webpack opt-in found:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log("[bundler-check] Turbopack is the only configured Next bundler.");
