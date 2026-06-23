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
	site: "https://docs.docklands.dev",
	integrations: [
		starlight({
			title: "Docklands",
			description:
				"Self-hosted, project-first deployment control plane you run on your own VM.",
			// Shared "feel": Kumo tokens + Starlight variable mapping. No coupling
			// to apps/docklands — both apps just import the Kumo package directly.
			customCss: ["./src/styles/docs.css"],
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
					items: [{ label: "Getting Started", slug: "getting-started" }],
				},
			],
		}),
	],
});
