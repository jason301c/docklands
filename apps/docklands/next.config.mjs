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
	turbopack: {},
	experimental: {
		cpus: buildCpus,
	},
	serverExternalPackages: ["cpu-features", "node-pty", "ssh2"],
	async redirects() {
		return [
			{
				source: "/dashboard/builds",
				destination: "/dashboard/deployments",
				permanent: false,
			},
			{
				source: "/dashboard/docker",
				destination: "/dashboard/container-runtime",
				permanent: false,
			},
			{
				source: "/dashboard/home",
				destination: "/dashboard/workspace",
				permanent: false,
			},
			{
				source: "/dashboard/ingress",
				destination: "/dashboard/proxy-files",
				permanent: false,
			},
			{
				source: "/dashboard/monitoring",
				destination: "/dashboard/host-metrics",
				permanent: false,
			},
			{
				source: "/dashboard/orchestration",
				destination: "/dashboard/cluster-runtime",
				permanent: false,
			},
			{
				source: "/dashboard/projects",
				destination: "/dashboard/workspace?view=workspaces",
				permanent: false,
			},
			{
				source: "/dashboard/runtime",
				destination: "/dashboard/container-runtime",
				permanent: false,
			},
			{
				source: "/dashboard/schedules",
				destination: "/dashboard/automations",
				permanent: false,
			},
			{
				source: "/dashboard/swarm",
				destination: "/dashboard/cluster-runtime",
				permanent: false,
			},
			{
				source: "/dashboard/traefik",
				destination: "/dashboard/proxy-files",
				permanent: false,
			},
			{
				source: "/dashboard/settings",
				destination: "/dashboard/settings/profile",
				permanent: false,
			},
			{
				source: "/dashboard/settings/cluster",
				destination: "/dashboard/settings/cluster-nodes",
				permanent: false,
			},
			{
				source: "/dashboard/settings/deployments",
				destination: "/dashboard/settings/build-workers",
				permanent: false,
			},
			{
				source: "/dashboard/settings/destinations",
				destination: "/dashboard/settings/storage",
				permanent: false,
			},
			{
				source: "/dashboard/settings/registry",
				destination: "/dashboard/settings/image-registry",
				permanent: false,
			},
			{
				source: "/dashboard/settings/server",
				destination: "/dashboard/settings/ingress",
				permanent: false,
			},
			{
				source: "/dashboard/settings/servers",
				destination: "/dashboard/settings/runtime",
				permanent: false,
			},
		];
	},
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
