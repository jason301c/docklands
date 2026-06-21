import { handleGitlabCallback } from "@/server/web/providers/gitlab-callback";

export const runtime = "nodejs";

const handler = (request: Request) => handleGitlabCallback(request);

export { handler as GET };
