import "@fontsource-variable/inter/index.css";
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

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			data-theme="kumo"
			className="h-full font-sans"
			suppressHydrationWarning
		>
			<body className="flex min-h-full w-full flex-col font-sans antialiased">
				{children}
			</body>
		</html>
	);
}
