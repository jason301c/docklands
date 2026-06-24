/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

import { fileURLToPath } from "node:url";

// Workspace root (two levels up from apps/docklands). Bun hoists dependencies
// such as `next` here, so Turbopack must use this as its root to resolve them.
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

const configuredBuildCpus = Number.parseInt(
	process.env.NEXT_BUILD_CPUS ?? "4",
	10,
);
const buildCpus = configuredBuildCpus > 0 ? configuredBuildCpus : 4;

/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Hide the floating Next.js dev indicator badge.
	devIndicators: false,
	allowedDevOrigins: ["0.0.0.0", "127.0.0.1"],
	// Pin the Turbopack workspace root. Without this, Next infers the root from
	// the nearest lockfile and can wrongly pick a parent/home directory (e.g. a
	// stray ~/pnpm-lock.yaml), causing it to scan the entire tree and never
	// finish compiling. Must be the Bun workspace root so hoisted deps resolve.
	turbopack: {
		root: workspaceRoot,
	},
	experimental: {
		cpus: buildCpus,
	},
	serverExternalPackages: ["cpu-features", "node-pty", "ssh2"],
	async headers() {
		return [
			{
				// Apply security headers to all routes
				source: "/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Content-Security-Policy",
						value: "frame-ancestors 'none'",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
				],
			},
		];
	},
};

export default nextConfig;
