import "@/styles/globals.css";

import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import Head from "next/head";
import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import type { ReactElement, ReactNode } from "react";
import { SearchCommand } from "@/components/dashboard/search-command";
import { WhitelabelingProvider } from "@/components/enterprise/whitelabeling/whitelabeling-provider";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/utils/trpc-provider";

const inter = Inter({ subsets: ["latin"] });

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
	getLayout?: (page: ReactElement) => ReactNode;
	theme?: string;
};

type AppPropsWithLayout = AppProps & {
	Component: NextPageWithLayout;
};

const MyApp = ({
	Component,
	pageProps: { ...pageProps },
}: AppPropsWithLayout) => {
	const getLayout = Component.getLayout ?? ((page) => page);

	return (
		<>
			<style jsx global>
				{`
					:root {
						--font-inter: ${inter.style.fontFamily};
					}
				`}
			</style>
			<Head>
				<title>Docklands</title>
			</Head>
			<TRPCReactProvider>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
					forcedTheme={Component.theme}
				>
					<NextTopLoader color="hsl(var(--sidebar-ring))" />
					<WhitelabelingProvider />
					<Toaster richColors />
					<SearchCommand />
					{getLayout(<Component {...pageProps} />)}
				</ThemeProvider>
			</TRPCReactProvider>
		</>
	);
};

export default MyApp;
