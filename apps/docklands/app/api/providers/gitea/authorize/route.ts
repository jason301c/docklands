import { handleGiteaAuthorize } from "@/server/web/providers/gitea-authorize";

export const runtime = "nodejs";

const handler = (request: Request) => handleGiteaAuthorize(request);

export { handler as GET };
