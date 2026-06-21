import "@/styles/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
});

export const metadata: Metadata = {
	title: "Docklands",
	icons: {
		icon: "/icon.svg",
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={inter.variable} suppressHydrationWarning>
			<body className="flex h-full w-full flex-col font-sans">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
