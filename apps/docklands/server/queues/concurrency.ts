import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { runtimeWorkers } from "@/server/core/db/schema";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { LOCAL_PARTITION } from "./in-memory-queue";

/**
 * Resolve the effective builds concurrency for a queue partition.
 *
 * - `LOCAL_PARTITION` -> concurrency stored on the web server settings (the
 *   local Docklands web server).
 * - any other partition -> concurrency stored on the matching `runtimeWorkers` row,
 *   scoped to that remote runtime worker.
 */
export const resolveBuildsConcurrency = async (
	partition: string,
): Promise<number> => {
	try {
		if (partition === LOCAL_PARTITION) {
			return await resolveLocalConcurrency();
		}
		return await resolveRuntimeWorkerConcurrency(partition);
	} catch (error) {
		console.error(
			"Failed to resolve builds concurrency, defaulting to 1",
			error,
		);
		return 1;
	}
};

const normalizeConcurrency = (value: number): number =>
	Math.max(1, Math.floor(value));

/**
 * Validate a requested builds-concurrency value before persisting it.
 * Docklands allows any positive integer; queue resolution floors values at 1.
 */
export const assertBuildsConcurrencyAllowed = async (
	_value: number,
	_organizationId: string,
): Promise<void> => {
	return;
};

const resolveLocalConcurrency = async (): Promise<number> => {
	const settings = await getWebServerSettings();
	const buildsConcurrency = settings?.buildsConcurrency ?? 1;

	return normalizeConcurrency(buildsConcurrency);
};

const resolveRuntimeWorkerConcurrency = async (
	runtimeWorkerId: string,
): Promise<number> => {
	const currentRuntimeWorker = await db.query.runtimeWorkers.findFirst({
		where: eq(runtimeWorkers.runtimeWorkerId, runtimeWorkerId),
		columns: { buildsConcurrency: true },
	});

	if (!currentRuntimeWorker) return 1;

	return normalizeConcurrency(currentRuntimeWorker.buildsConcurrency);
};
