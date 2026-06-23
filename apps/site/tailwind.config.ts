import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Trimmed copy of apps/docklands/tailwind.config.ts: dark mode is driven by a
// `data-mode="dark"` attribute (set by Kumo's theme), and the Inter font is
// wired through the `--font-inter` CSS variable that next/font exposes in the
// root layout.
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
			},
			maxWidth: {
				"7xl": "80rem",
			},
		},
	},
} satisfies Config;

export default config;
