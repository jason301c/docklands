/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

const configuredBuildCpus = Number.parseInt(
	process.env.NEXT_BUILD_CPUS ?? "4",
	10,
);
const buildCpus = configuredBuildCpus > 0 ? configuredBuildCpus : 4;

/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	allowedDevOrigins: ["0.0.0.0", "127.0.0.1"],
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
