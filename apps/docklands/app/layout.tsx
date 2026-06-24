import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/fraunces/index.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
	title: "Docklands",
	icons: {
		icon: "/docklands-logo.svg",
	},
};

export const dynamic = "force-dynamic";

// Runs before first paint to apply the stored/system theme synchronously,
// preventing a light-mode flash on refresh. Must mirror ThemeProvider
// (storageKey "theme", default "system", attribute data-mode + color-scheme).
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var e=document.documentElement;e.dataset.mode=r;e.style.colorScheme=r;}catch(_){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			className="h-full font-sans"
			data-theme="kumo"
			suppressHydrationWarning
		>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-hydration theme script to avoid FOUC */}
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
			</head>
			<body className="flex min-h-full w-full flex-col font-sans">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
