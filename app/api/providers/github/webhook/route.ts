import { handleGithubProviderWebhook } from "@/server/web/providers/github-webhook";

export const runtime = "nodejs";

const handler = (request: Request) => handleGithubProviderWebhook(request);

export { handler as POST };
