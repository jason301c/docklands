import { handleGitlabAuthorize } from "@/server/web/providers/gitlab-authorize";

export const runtime = "nodejs";

const handler = (request: Request) => handleGitlabAuthorize(request);

export { handler as GET };
