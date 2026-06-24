"use client";

import {
	MutationCache,
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import {
	createWSClient,
	httpBatchLink,
	httpLink,
	splitLink,
	wsLink,
} from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { api } from "@/client/api/trpc";
import { handleGlobalError, shouldRetry } from "@/client/lib/trpc-error";

const getBaseUrl = () => {
	if (typeof window !== "undefined") return "";
	return `http://localhost:${process.env.PORT ?? 3000}`;
};

const getWsUrl = () => {
	if (typeof window === "undefined") return null;

	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const host = window.location.host;

	return `${protocol}${host}/drawer-logs`;
};

let browserQueryClient: QueryClient | undefined;
let wsClientSingleton: ReturnType<typeof createWSClient> | undefined;

const makeQueryClient = () =>
	new QueryClient({
		// Global resilience layer: every failed query/mutation is classified,
		// logged, and surfaced (auth loss → login, forbidden/generic → toast) in
		// one place, so no call site needs bespoke error handling for a failure
		// to be visible. See `client/lib/trpc-error.ts`.
		queryCache: new QueryCache({
			onError: (error) => handleGlobalError(error, "query"),
		}),
		mutationCache: new MutationCache({
			onError: (error, _vars, _ctx, mutation) =>
				handleGlobalError(error, "mutation", {
					toastGeneric: mutation.meta?.globalErrorToast === true,
				}),
		}),
		defaultOptions: {
			queries: {
				refetchOnWindowFocus: false,
				retry: shouldRetry,
			},
		},
	});

const getQueryClient = () => {
	if (typeof window === "undefined") {
		return makeQueryClient();
	}

	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient();
	}

	return browserQueryClient;
};

const getOrCreateWSClient = () => {
	if (typeof window === "undefined") return null;

	if (!wsClientSingleton) {
		wsClientSingleton = createWSClient({
			url: getWsUrl()!,
			lazy: { enabled: true, closeMs: 3000 },
			retryDelayMs: () => 3000,
		});
	}

	return wsClientSingleton;
};

const createLinks = () => {
	if (typeof window === "undefined") {
		return [
			httpBatchLink({
				url: `${getBaseUrl()}/api/trpc`,
				transformer: superjson,
			}),
		];
	}

	return [
		splitLink({
			condition: (op) => op.type === "subscription",
			true: wsLink({
				client: getOrCreateWSClient()!,
				transformer: superjson,
			}),
			false: splitLink({
				condition: (op) => op.input instanceof FormData,
				true: httpLink({
					url: `${getBaseUrl()}/api/trpc`,
					transformer: superjson,
				}),
				false: httpBatchLink({
					url: `${getBaseUrl()}/api/trpc`,
					transformer: superjson,
				}),
			}),
		}),
	];
};

export const TRPCReactProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const queryClient = getQueryClient();
	const [trpcClient] = useState(() =>
		api.createClient({
			links: createLinks(),
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<api.Provider client={trpcClient} queryClient={queryClient}>
				{children}
			</api.Provider>
		</QueryClientProvider>
	);
};
