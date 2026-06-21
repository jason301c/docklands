"use client";

import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import { SearchCommand } from "@/components/dashboard/search-command";
import { WhitelabelingProvider } from "@/components/enterprise/whitelabeling/whitelabeling-provider";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/utils/trpc-provider";

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
				<WhitelabelingProvider />
				<Toaster richColors />
				<SearchCommand />
				{children}
			</ThemeProvider>
		</TRPCReactProvider>
	);
};
