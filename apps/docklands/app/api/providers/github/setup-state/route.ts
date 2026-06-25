import { handleGithubProviderSetupState } from "@/server/web/providers/github-setup-init";

export const runtime = "nodejs";

const handler = (request: Request) => handleGithubProviderSetupState(request);

export { handler as GET };
