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

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			className="h-full font-sans"
			data-theme="kumo"
			suppressHydrationWarning
		>
			<body className="flex min-h-full w-full flex-col font-sans">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
