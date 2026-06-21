import { handleGiteaCallback } from "@/server/web/providers/gitea-callback";

export const runtime = "nodejs";

const handler = (request: Request) => handleGiteaCallback(request);

export { handler as GET };
