import { sql } from "drizzle-orm";
import { db } from "@/server/core/db";
import { createLogger } from "@/server/core/lib/logger";

export const runtime = "nodejs";

const logger = createLogger("health");

// DB-aware liveness/readiness: a static 200 reported "healthy" even when the
// database was unreachable, so external uptime checks were falsely green. Probe
// the DB (matching the Dockerfile's settings.health check) and return 503 when
// it's down so monitors and orchestrators see the real state.
export const GET = async () => {
	try {
		await db.execute(sql`SELECT 1`);
		return Response.json({ ok: true });
	} catch (error) {
		logger.error({ err: error }, "Health check failed: database unreachable");
		return Response.json(
			{ ok: false, error: "database unreachable" },
			{ status: 503 },
		);
	}
};
