import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Trimmed copy of apps/docklands/tailwind.config.ts: dark mode is driven by a
// `data-mode="dark"` attribute (set by Kumo's theme). Fonts are self-hosted via
// `@fontsource-variable/*` (imported in app/layout.tsx) and surfaced through the
// `--font-inter` (body) and `--font-fraunces` (display) CSS variables.
const config = {
	darkMode: ["selector", '[data-mode="dark"]'],
	content: [
		"./app/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./lib/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
				display: ["var(--font-fraunces)", ...defaultTheme.fontFamily.serif],
			},
			maxWidth: {
				"7xl": "80rem",
			},
		},
	},
} satisfies Config;

export default config;
