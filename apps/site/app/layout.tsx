import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/fraunces/index.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: {
		default: "Docklands - self-host your apps",
		template: "%s - Docklands",
	},
	description:
		"Docklands is a self-hosted deployment platform you run on your own VM. " +
		"Deploy from Git, Docker images, and Compose. Manage databases, ingress, " +
		"backups, and runtime workers on infrastructure you own.",
	icons: { icon: "/docklands-logo.svg" },
};

// The marketing site is intentionally dark-only, for its high-contrast premium
// look. The palette itself is light/dark-capable (every token is a `light-dark()`
// pair in globals.css), but here we pin dark: `data-mode="dark"` plus
// `color-scheme: dark` make every `light-dark()` token resolve to its dark value,
// regardless of the visitor's OS theme. The app reuses the same palette and can
// expose a real toggle by flipping these two attributes.
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			data-theme="kumo"
			data-mode="dark"
			className="h-full font-sans"
			style={{ colorScheme: "dark" }}
		>
			<body className="flex min-h-full w-full flex-col font-sans antialiased">
				{children}
			</body>
		</html>
	);
}
