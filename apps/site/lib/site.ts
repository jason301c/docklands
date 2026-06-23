/**
 * Central place for marketing-site copy and outbound links.
 *
 * NOTE: the URLs below are placeholders — point them at the real repository,
 * docs deployment, and canonical domain before launch.
 */
export const siteConfig = {
	name: "Docklands",
	tagline: "Deploy anything on infrastructure you own.",
	description:
		"A self-hosted deployment control plane for your own VM. Git, Docker, and " +
		"Compose deploys, managed databases, ingress, backups, and runtime workers.",
	url: "https://docklands.dev",
	links: {
		github: "https://github.com/docklands/docklands",
		docs: "https://docs.docklands.dev",
	},
	// Replace with the real one-line installer once it exists.
	install: "curl -sSL https://get.docklands.dev | sh",
} as const;
