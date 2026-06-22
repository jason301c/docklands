"use client";

import NextTopLoader from "nextjs-toploader";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/client/providers/theme-provider";
import { TRPCReactProvider } from "@/client/providers/trpc-provider";
import { SearchCommand } from "@/components/dashboard/search-command";
import { Toaster } from "@/components/shared/toast";

export const Providers = ({ children }: { children: ReactNode }) => {
	return (
		<TRPCReactProvider>
			<ThemeProvider attribute="data-mode" defaultTheme="system" enableSystem>
				<NextTopLoader color="var(--color-kumo-brand)" />
				<Toaster />
				<SearchCommand />
				{children}
			</ThemeProvider>
		</TRPCReactProvider>
	);
};
