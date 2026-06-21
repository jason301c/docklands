import { handleApplicationDeployWebhook } from "@/server/web/deploy/application-webhook";

export const runtime = "nodejs";

type RouteContext = {
	params: Promise<{ refreshToken: string }>;
};

const handler = async (request: Request, context: RouteContext) =>
	handleApplicationDeployWebhook(request, (await context.params).refreshToken);

export { handler as GET, handler as POST };
