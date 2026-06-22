import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config = {
	darkMode: ["selector", '[data-mode="dark"]'],
	content: [
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./client/**/*.{ts,tsx}",
		"./shared/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "87.5rem",
			},
		},
		extend: {
			fontFamily: {
				sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
			},
			screens: {
				"3xl": "1920px",
			},
			maxWidth: {
				"2xl": "40rem",
				"8xl": "85rem",
				"9xl": "95rem",
				"10xl": "105rem",
			},
			keyframes: {
				"caret-blink": {
					"0%,70%,100%": {
						opacity: "1",
					},
					"20%,50%": {
						opacity: "0",
					},
				},
			},
			animation: {
				"caret-blink": "caret-blink 1.25s ease-out infinite",
			},
		},
	},
	plugins: [require("fancy-ansi/plugin"), require("@tailwindcss/typography")],
} satisfies Config;

export default config;
