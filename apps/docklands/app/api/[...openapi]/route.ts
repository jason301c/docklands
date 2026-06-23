import type { TRPCError } from "@trpc/server";
import { appRouter } from "@/server/api/root";
import { createFetchTRPCContext, logTRPCError } from "@/server/api/trpc";
import { validateRequestHeaders } from "@/server/core/lib/auth";
import { createOpenApiFetchHandler } from "@/server/core/openapi/adapters/fetch.mjs";

export const runtime = "nodejs";

const handler = async (req: Request) => {
	const { session, user } = await validateRequestHeaders(req.headers);

	if (!user || !session) {
		return Response.json({ message: "Unauthorized" }, { status: 401 });
	}

	return createOpenApiFetchHandler({
		endpoint: "/api",
		req,
		router: appRouter,
		createContext: createFetchTRPCContext,
		onError: ({ path, error }: { path: string | undefined; error: Error }) =>
			logTRPCError({ path, error: error as TRPCError, type: "openapi" }),
	});
};

export {
	handler as DELETE,
	handler as GET,
	handler as PATCH,
	handler as POST,
	handler as PUT,
};
