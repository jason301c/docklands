import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Pin the Turbopack workspace root to the Bun workspace root (two levels up).
// Hoisted deps (next, react, @cloudflare/kumo) live there; without this pin Next
// can infer the wrong root from a stray parent lockfile and scan the whole tree.
// Mirrors apps/docklands/next.config.mjs.
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

const nextConfig: NextConfig = {
	reactStrictMode: true,
	turbopack: {
		root: workspaceRoot,
	},
	// Security headers for a public marketing surface. (Dropped automatically if
	// you switch to `output: "export"`, which has no server to set headers.)
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				],
			},
		];
	},
};

export default nextConfig;
