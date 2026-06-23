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
		docs: "https://docs.docklands.sh",
	},
	// Replace with the real one-line installer once it exists.
	install: "curl -sSL https://get.docklands.sh | sh",
} as const;
