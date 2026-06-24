import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// Mirror Starlight's `data-theme` onto Kumo's `data-mode` so the shared Kumo
// design tokens flip light/dark in step with the docs theme toggle. Runs in
// <head> before paint, then observes subsequent toggles.
const KUMO_THEME_BRIDGE = `(() => {
	const root = document.documentElement;
	const apply = () => {
		const theme = root.dataset.theme ||
			(matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
		if (theme === "dark") root.dataset.mode = "dark";
		else root.removeAttribute("data-mode");
	};
	apply();
	new MutationObserver(apply).observe(root, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
})();`;

// https://astro.build/config
export default defineConfig({
	site: "https://docs.docklands.sh",
	integrations: [
		starlight({
			title: "Docklands",
			description:
				"Self-hosted, project-first deployment control plane you run on your own VM.",
			// Brand logo (dark ink on the light theme, white on the dark theme) + favicon.
			logo: {
				light: "./src/assets/docklands-logo-dark.svg",
				dark: "./src/assets/docklands-logo-light.svg",
			},
			favicon: "/favicon.svg",
			// Shared "feel": Kumo tokens + Starlight variable mapping. No coupling
			// to apps/docklands — both apps just import the Kumo package directly.
			customCss: ["./src/styles/docs.css"],
			// Left-rail layout: the top bar is removed and its contents move into
			// the sidebar (Sidebar.astro); the Auto/Light/Dark select becomes a
			// sun/moon toggle (ThemeToggle.astro). Header + MobileMenuFooter render
			// nothing — the rail owns the brand, search, social, and theme controls.
			components: {
				Header: "./src/components/Empty.astro",
				MobileMenuFooter: "./src/components/Empty.astro",
				Sidebar: "./src/components/Sidebar.astro",
				ThemeSelect: "./src/components/ThemeToggle.astro",
			},
			plugins: [starlightLlmsTxt()],
			head: [
				{
					tag: "script",
					content: KUMO_THEME_BRIDGE,
				},
			],
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/dokploy/dokploy",
				},
			],
			sidebar: [
				{
					label: "Start Here",
					items: [
						{ slug: "concepts/what-is-docklands" },
						{ slug: "getting-started" },
						{ slug: "concepts/architecture" },
						{ slug: "concepts/glossary" },
					],
				},
				{
					label: "Install & Operate",
					items: [
						{ slug: "install/requirements" },
						{ slug: "install/production" },
						{ slug: "install/configuration" },
						{ slug: "install/operations" },
					],
				},
				{
					label: "Workspace",
					items: [
						{ slug: "workspace/overview" },
						{ slug: "workspace/environments" },
						{ slug: "workspace/services-and-connections" },
						{ slug: "workspace/topology" },
						{ slug: "workspace/navigation" },
					],
				},
				{
					label: "Applications",
					items: [
						{ slug: "applications/overview" },
						{ slug: "applications/sources" },
						{ slug: "applications/builds" },
						{ slug: "applications/environment-variables" },
						{ slug: "applications/ports" },
						{ slug: "applications/domains" },
						{ slug: "applications/advanced" },
						{ slug: "applications/patches" },
						{ slug: "applications/security" },
						{ slug: "applications/preview-deployments" },
						{ slug: "applications/rollbacks" },
					],
				},
				{
					label: "Databases",
					items: [
						{ slug: "databases/overview" },
						{ slug: "databases/creating-a-database" },
						{ slug: "databases/connection-variables" },
						{ slug: "databases/external-access" },
						{ slug: "databases/backups" },
						{ slug: "databases/managing" },
					],
				},
				{
					label: "Compose & Templates",
					items: [
						{ slug: "compose/overview" },
						{ slug: "compose/templates" },
						{ slug: "compose/embedded-databases" },
					],
				},
				{
					label: "Networking",
					items: [
						{ slug: "networking/cloudflare-tunnels" },
						{ slug: "networking/domains" },
						{ slug: "networking/tls-certificates" },
						{ slug: "networking/ingress" },
						{ slug: "networking/redirects" },
					],
				},
				{
					label: "Git & Source",
					items: [
						{ slug: "git/overview" },
						{ slug: "git/github" },
						{ slug: "git/gitlab" },
						{ slug: "git/bitbucket" },
						{ slug: "git/gitea" },
						{ slug: "git/ssh-keys" },
					],
				},
				{
					label: "Runtime & Cluster",
					items: [
						{ slug: "runtime/overview" },
						{ slug: "runtime/runtime-workers" },
						{ slug: "runtime/cluster" },
						{ slug: "runtime/docker-resources" },
					],
				},
				{
					label: "Backups & Storage",
					items: [
						{ slug: "backups/overview" },
						{ slug: "backups/destinations" },
						{ slug: "backups/database-backups" },
						{ slug: "backups/volume-backups" },
						{ slug: "backups/schedules" },
					],
				},
				{
					label: "Observability",
					items: [
						{ slug: "observability/deployments-and-logs" },
						{ slug: "observability/metrics" },
						{ slug: "observability/requests" },
						{ slug: "observability/audit-log" },
					],
				},
				{
					label: "Access Control",
					items: [
						{ slug: "access/organizations" },
						{ slug: "access/users-and-members" },
						{ slug: "access/roles-and-permissions" },
						{ slug: "access/profile-and-security" },
					],
				},
				{
					label: "Settings & Integrations",
					items: [
						{ slug: "settings/image-registries" },
						{ slug: "settings/notifications" },
						{ slug: "settings/tags" },
						{ slug: "settings/server-settings" },
					],
				},
			],
		}),
	],
});
