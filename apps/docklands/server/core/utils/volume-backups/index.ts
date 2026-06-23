export * from "./backup";
export * from "./restore";
export * from "./utils";

import { eq } from "drizzle-orm";
import { volumeBackups } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { db } from "../../db/index";
import { scheduleVolumeBackup } from "./utils";

const logger = createLogger("volume-backup");

export const initVolumeBackupsCronJobs = async () => {
	logger.info("Initializing volume backup cron jobs");
	try {
		const volumeBackupsResult = await db.query.volumeBackups.findMany({
			where: eq(volumeBackups.enabled, true),
			with: {
				application: true,
				compose: true,
			},
		});

		logger.info({ count: volumeBackupsResult.length }, "Volume backup count");
		for (const volumeBackup of volumeBackupsResult) {
			scheduleVolumeBackup(volumeBackup.volumeBackupId);
			logger.info(
				{
					volumeBackupId: volumeBackup.volumeBackupId,
					name: volumeBackup.name,
					serviceType: volumeBackup.serviceType,
				},
				"Volume backup job scheduled",
			);
		}
	} catch (error) {
		logger.error(
			{ err: error },
			"Failed to initialize volume backup cron jobs",
		);
		throw error;
	}
};
