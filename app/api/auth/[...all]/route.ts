import { auth } from "@/server-core/lib/auth";

export const runtime = "nodejs";

const handler = auth.handler;

export {
	handler as DELETE,
	handler as GET,
	handler as PATCH,
	handler as POST,
	handler as PUT,
};
