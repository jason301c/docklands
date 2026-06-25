import { sql } from "drizzle-orm";
import { db } from "@/server/core/db";
import { createLogger } from "@/server/core/lib/logger";
import { getReadinessSnapshot } from "@/server/core/readiness";

export const runtime = "nodejs";

const logger = createLogger("readiness");

export const GET = async () => {
	const runtimeReadiness = getReadinessSnapshot({ preferPersisted: true });

	try {
		await db.execute(sql`SELECT 1`);
	} catch (error) {
		logger.error(
			{ err: error },
			"Readiness check failed: database unreachable",
		);
		return Response.json(
			{
				checks: {
					database: { ok: false, error: "database unreachable" },
					runtime: runtimeReadiness,
				},
				ok: false,
			},
			{ status: 503 },
		);
	}

	if (!runtimeReadiness.ok) {
		return Response.json(
			{
				checks: {
					database: { ok: true },
					runtime: runtimeReadiness,
				},
				ok: false,
			},
			{ status: 503 },
		);
	}

	return Response.json({
		checks: {
			database: { ok: true },
			runtime: runtimeReadiness,
		},
		ok: true,
	});
};
