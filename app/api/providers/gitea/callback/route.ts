import legacyHandler from "@/server/web/legacy-api/providers/gitea/callback";
import { runNextApiHandler } from "@/server/web/next-api-compat";

export const runtime = "nodejs";

const handler = (request: Request) => runNextApiHandler(request, legacyHandler);

export { handler as GET };
