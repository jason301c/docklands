import { handleGithubDeployWebhook } from "@/server/web/deploy/github-webhook";

export const runtime = "nodejs";

const handler = (request: Request) => handleGithubDeployWebhook(request);

export { handler as POST };
