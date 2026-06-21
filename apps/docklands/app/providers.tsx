"use client";

import {
	ThemeProvider as NextThemesProvider,
	type ThemeProviderProps,
} from "next-themes";
import NextTopLoader from "nextjs-toploader";
import type { ComponentType, ReactNode } from "react";
import { TRPCReactProvider } from "@/client/providers/trpc-provider";
import { SearchCommand } from "@/components/dashboard/search-command";
import { Toaster } from "@/components/shared/toast";

const ThemeProvider = NextThemesProvider as ComponentType<
	ThemeProviderProps & { children?: ReactNode }
>;

export const Providers = ({ children }: { children: ReactNode }) => {
	return (
		<TRPCReactProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<NextTopLoader color="hsl(var(--sidebar-ring))" />
				<Toaster />
				<SearchCommand />
				{children}
			</ThemeProvider>
		</TRPCReactProvider>
	);
};
