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
			colors: {
				border: "var(--color-kumo-hairline)",
				input: "var(--color-kumo-control)",
				ring: "var(--color-kumo-focus)",
				background: "var(--color-kumo-canvas)",
				foreground: "var(--text-color-kumo-default)",
				primary: {
					DEFAULT: "var(--color-kumo-brand)",
					foreground: "var(--text-color-kumo-inverse)",
				},
				secondary: {
					DEFAULT: "var(--color-kumo-fill)",
					foreground: "var(--text-color-kumo-default)",
				},
				destructive: {
					DEFAULT: "var(--color-kumo-danger)",
					foreground: "var(--text-color-kumo-inverse)",
				},
				muted: {
					DEFAULT: "var(--color-kumo-fill)",
					foreground: "var(--text-color-kumo-subtle)",
				},
				accent: {
					DEFAULT: "var(--color-kumo-fill-hover)",
					foreground: "var(--text-color-kumo-default)",
				},
				popover: {
					DEFAULT: "var(--color-kumo-elevated)",
					foreground: "var(--text-color-kumo-default)",
				},
				card: {
					DEFAULT: "var(--color-kumo-base)",
					foreground: "var(--text-color-kumo-default)",
				},
				sidebar: {
					DEFAULT: "var(--color-kumo-elevated)",
					foreground: "var(--text-color-kumo-default)",
					primary: "var(--color-kumo-brand)",
					"primary-foreground": "var(--text-color-kumo-inverse)",
					accent: "var(--color-kumo-fill-hover)",
					"accent-foreground": "var(--text-color-kumo-default)",
					border: "var(--color-kumo-hairline)",
					ring: "var(--color-kumo-focus)",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
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
				"accordion-down": {
					from: {
						height: "0",
					},
					to: {
						height: "var(--radix-accordion-content-height)",
					},
				},
				"accordion-up": {
					from: {
						height: "var(--radix-accordion-content-height)",
					},
					to: {
						height: "0",
					},
				},
			},
			animation: {
				"caret-blink": "caret-blink 1.25s ease-out infinite",
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	plugins: [
		require("tailwindcss-animate"),
		require("fancy-ansi/plugin"),
		require("@tailwindcss/typography"),
	],
} satisfies Config;

export default config;
