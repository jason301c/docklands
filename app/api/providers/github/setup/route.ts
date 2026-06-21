import { handleGithubProviderSetup } from "@/server/web/providers/github-setup";

export const runtime = "nodejs";

const handler = (request: Request) => handleGithubProviderSetup(request);

export { handler as GET };
