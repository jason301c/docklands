import legacyHandler from "@/server/web/legacy-api/deploy/[refreshToken]";
import { runNextApiHandler } from "@/server/web/next-api-compat";

export const runtime = "nodejs";

type RouteContext = {
	params: Promise<{ refreshToken: string }>;
};

const handler = async (request: Request, context: RouteContext) =>
	runNextApiHandler(request, legacyHandler, await context.params);

export { handler as GET, handler as POST };
