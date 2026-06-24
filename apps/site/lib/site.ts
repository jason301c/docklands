/**
 * Central place for marketing-site copy and outbound links.
 */
export const siteConfig = {
	name: "Docklands",
	tagline: "Docklands - self-host your apps",
	description:
		"A self-hosted deployment control plane for your own VM. Git, Docker, and " +
		"Compose deploys, managed databases, ingress, backups, and runtime workers.",
	url: "https://docklands.sh",
	links: {
		github: "https://github.com/jason301c/docklands",
		// The docs site is a separate deployable (apps/docs, Astro on port 4321).
		// In `next dev` point at the local docs server; otherwise the public host.
		// NODE_ENV is inlined by Next at build time, so this resolves correctly for
		// both the dev server and the static export.
		docs:
			process.env.NODE_ENV === "development"
				? "http://localhost:4321"
				: "https://docs.docklands.sh",
	},
	// Replace with the real one-line installer once it exists.
	install: "curl -sSL https://get.docklands.sh | sh",
} as const;
