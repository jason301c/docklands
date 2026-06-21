import { handleComposeDeployWebhook } from "@/server/web/deploy/compose-webhook";

export const runtime = "nodejs";

type RouteContext = {
	params: Promise<{ refreshToken: string }>;
};

const handler = async (request: Request, context: RouteContext) =>
	handleComposeDeployWebhook(request, (await context.params).refreshToken);

export { handler as GET, handler as POST };
