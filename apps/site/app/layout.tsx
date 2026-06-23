import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/fraunces/index.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: {
		default: "Docklands — Self-hosted deployment control plane",
		template: "%s — Docklands",
	},
	description:
		"Docklands is a self-hosted deployment platform you run on your own VM. " +
		"Deploy from Git, Docker images, and Compose; manage databases, ingress, " +
		"backups, and runtime workers — all on infrastructure you own.",
	icons: { icon: "/docklands-logo.svg" },
};

// The marketing site is intentionally light-only. We never set `data-mode="dark"`,
// and we pin `color-scheme: light` on the root, so Kumo's `light-dark()` tokens
// always resolve to their light values regardless of the visitor's OS theme.
// (The app and docs still follow the OS preference; the site deliberately does not.)
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			data-theme="kumo"
			className="h-full font-sans"
			style={{ colorScheme: "light" }}
		>
			<body className="flex min-h-full w-full flex-col font-sans antialiased">
				{children}
			</body>
		</html>
	);
}
