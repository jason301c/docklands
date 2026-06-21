"use client";

import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import { TRPCReactProvider } from "@/client/providers/trpc-provider";
import { SearchCommand } from "@/components/dashboard/search-command";
import { Toaster } from "@/components/ui/sonner";

export const Providers = ({ children }: { children: React.ReactNode }) => {
	return (
		<TRPCReactProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<NextTopLoader color="hsl(var(--sidebar-ring))" />
				<Toaster richColors />
				<SearchCommand />
				{children}
			</ThemeProvider>
		</TRPCReactProvider>
	);
};
