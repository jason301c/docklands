import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createFetchTRPCContext } from "@/server/api/trpc";

export const runtime = "nodejs";

const handler = (req: Request) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req,
		router: appRouter,
		createContext: createFetchTRPCContext,
		onError:
			process.env.NODE_ENV === "development"
				? ({ path, error }) => {
						console.error(
							`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
						);
					}
				: undefined,
	});

export { handler as GET, handler as POST };
