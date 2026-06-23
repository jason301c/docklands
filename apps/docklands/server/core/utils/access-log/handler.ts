import fs from "node:fs";
import path from "node:path";
import { scheduledJobs, scheduleJob } from "node-schedule";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "@/server/core/services/web-server-settings";
import { execAsync } from "../process/execAsync";

const logger = createLogger("access-log");

const LOG_CLEANUP_JOB_NAME = "access-log-cleanup";

export const startLogCleanup = async (
	cronExpression = "0 0 * * *",
): Promise<boolean> => {
	try {
		const existingJob = scheduledJobs[LOG_CLEANUP_JOB_NAME];
		if (existingJob) {
			existingJob.cancel();
		}

		scheduleJob(LOG_CLEANUP_JOB_NAME, cronExpression, async () => {
			try {
				logger.info({ cronExpression }, "Access log cleanup running");
				const { DYNAMIC_TRAEFIK_PATH } = paths();
				const accessLogPath = path.join(DYNAMIC_TRAEFIK_PATH, "access.log");

				if (!fs.existsSync(accessLogPath)) {
					logger.warn(
						{ accessLogPath },
						"Access log file not found; skipping cleanup",
					);
					return;
				}

				await execAsync(
					`tail -n 1000 ${accessLogPath} > ${accessLogPath}.tmp && mv ${accessLogPath}.tmp ${accessLogPath}`,
				);

				// Traefik can run as a standalone container ("docklands-traefik") or a
				// swarm service task ("docklands-traefik.1.<task-id>"), so resolve the
				// running container id dynamically instead of assuming the name.
				const { stdout: containerId } = await execAsync(
					'docker ps -q --filter "name=docklands-traefik" --filter "status=running" | head -n 1',
				);
				const traefikContainerId = containerId.trim();
				if (!traefikContainerId) {
					logger.warn("Traefik container not found; log reopen skipped");
					return;
				}
				await execAsync(`docker exec ${traefikContainerId} kill -USR1 1`);
				logger.info({ traefikContainerId }, "Traefik log file reopened");
			} catch (error) {
				logger.error({ err: error }, "Access log cleanup error");
			}
		});

		await updateWebServerSettings({
			logCleanupCron: cronExpression,
		});

		return true;
	} catch (error) {
		logger.error(
			{ err: error, cronExpression },
			"Failed to start access-log cleanup job",
		);
		return false;
	}
};

export const stopLogCleanup = async (): Promise<boolean> => {
	try {
		const existingJob = scheduledJobs[LOG_CLEANUP_JOB_NAME];
		if (existingJob) {
			existingJob.cancel();
		}

		// Update database
		await updateWebServerSettings({
			logCleanupCron: null,
		});

		return true;
	} catch (error) {
		logger.error({ err: error }, "Failed to stop access-log cleanup job");
		return false;
	}
};

export const getLogCleanupStatus = async (): Promise<{
	enabled: boolean;
	cronExpression: string | null;
}> => {
	const settings = await getWebServerSettings();
	const cronExpression = settings?.logCleanupCron ?? null;
	return {
		enabled: cronExpression !== null,
		cronExpression,
	};
};
