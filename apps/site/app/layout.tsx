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

// Pre-paint OS-theme bridge: Kumo's dark tokens key off `data-mode="dark"` on
// <html>. The site has no theme toggle, so we mirror the OS `prefers-color-scheme`
// onto `data-mode` (and keep it in sync if the OS setting changes), matching how
// the app (next-themes, system default) and docs (Starlight bridge) behave. Runs
// before the body paints to avoid a light-mode flash; `suppressHydrationWarning`
// on <html> covers the attribute it sets ahead of hydration.
const THEME_BRIDGE = `(() => {
	try {
		const root = document.documentElement;
		const mq = matchMedia("(prefers-color-scheme: dark)");
		const apply = () => {
			if (mq.matches) root.dataset.mode = "dark";
			else root.removeAttribute("data-mode");
		};
		apply();
		mq.addEventListener("change", apply);
	} catch {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			data-theme="kumo"
			className="h-full font-sans"
			suppressHydrationWarning
		>
			<body className="flex min-h-full w-full flex-col font-sans antialiased">
				<script dangerouslySetInnerHTML={{ __html: THEME_BRIDGE }} />
				{children}
			</body>
		</html>
	);
}
