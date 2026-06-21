import fs from "node:fs";
import path from "node:path";
import { scheduledJobs, scheduleJob } from "node-schedule";
import { paths } from "@/server/core/constants/paths";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "@/server/core/services/web-server-settings";
import { execAsync } from "../process/execAsync";

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
				const { DYNAMIC_TRAEFIK_PATH } = paths();
				const accessLogPath = path.join(DYNAMIC_TRAEFIK_PATH, "access.log");

				if (!fs.existsSync(accessLogPath)) {
					console.error("Access log file does not exist");
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
					console.error("Traefik container not found, skipping log reopen");
					return;
				}
				await execAsync(`docker exec ${traefikContainerId} kill -USR1 1`);
			} catch (error) {
				console.error("Error during log cleanup:", error);
			}
		});

		await updateWebServerSettings({
			logCleanupCron: cronExpression,
		});

		return true;
	} catch (error) {
		console.error("Error starting log cleanup:", error);
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
		console.error("Error stopping log cleanup:", error);
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
