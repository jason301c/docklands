import { eq } from "drizzle-orm";
import { scheduleJob } from "node-schedule";
import { CLEANUP_CRON_JOB } from "@/server/core/constants/cleanup";
import { member } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import type { BackupSchedule } from "@/server/core/services/backup";
import { findDestinationById } from "@/server/core/services/destination";
import { getAllRuntimeWorkers } from "@/server/core/services/runtime-worker";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { db } from "../../db/index";
import { startLogCleanup } from "../access-log/handler";
import { cleanupAll } from "../docker/utils";
import { sendDockerCleanupNotifications } from "../notifications/docker-cleanup";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { redactRcloneCredentials } from "./redact";
import {
	getS3CredentialEnv,
	getS3Credentials,
	normalizeS3Path,
	scheduleBackup,
} from "./utils";

const logger = createLogger("backup");

export const initCronJobs = async () => {
	logger.info("Initializing backup cron jobs");

	const admin = await db.query.member.findFirst({
		where: eq(member.role, "owner"),
		with: {
			user: true,
		},
	});

	if (!admin) {
		return;
	}

	const webServerSettings = await getWebServerSettings();

	if (webServerSettings?.enableDockerCleanup) {
		try {
			scheduleJob("docker-cleanup", CLEANUP_CRON_JOB, async () => {
				logger.info("Docker cleanup running");

				await cleanupAll();

				await sendDockerCleanupNotifications(admin.user.id);
			});
		} catch (error) {
			logger.error({ err: error }, "Docker cleanup schedule error");
		}
	}

	const servers = await getAllRuntimeWorkers();

	for (const runtimeWorker of servers) {
		const { runtimeWorkerId, enableDockerCleanup, name } = runtimeWorker;
		if (enableDockerCleanup) {
			try {
				scheduleJob(runtimeWorkerId, CLEANUP_CRON_JOB, async () => {
					logger.info(
						{ runtimeWorkerId, name },
						"Remote docker cleanup running",
					);

					await cleanupAll(runtimeWorkerId);

					await sendDockerCleanupNotifications(
						admin.user.id,
						`Docker cleanup for Server ${name} (${runtimeWorkerId})`,
					);
				});
			} catch (error) {
				logger.error(
					{ err: error, runtimeWorkerId, name },
					"Remote docker cleanup error",
				);
			}
		}
	}

	const backups = await db.query.backups.findMany({
		with: {
			destination: true,
			database: true,
			user: true,
			compose: true,
		},
	});

	for (const backup of backups) {
		try {
			if (backup.enabled) {
				scheduleBackup(backup);
				logger.info(
					{
						backupId: backup.backupId,
						databaseType: backup.databaseType,
						schedule: backup.schedule,
					},
					"Backup job scheduled",
				);
			}
		} catch (error) {
			logger.error(
				{
					err: error,
					backupId: backup.backupId,
					databaseType: backup.databaseType,
				},
				"Failed to schedule backup job",
			);
		}
	}

	if (webServerSettings?.logCleanupCron) {
		try {
			logger.info(
				{ cron: webServerSettings.logCleanupCron },
				"Starting access-log cleanup",
			);
			await startLogCleanup(webServerSettings.logCleanupCron);
		} catch (error) {
			logger.error({ err: error }, "Failed to start log cleanup");
		}
	}
};

const getServiceAppName = (backup: BackupSchedule): string => {
	if (backup.compose?.appName) {
		return backup.serviceName
			? `${backup.compose.appName}_${backup.serviceName}`
			: backup.compose.appName;
	}
	// For managed-database backups the S3 prefix uses the database's appName.
	return backup.database?.appName || backup.appName;
};

export const keepLatestNBackups = async (
	backup: BackupSchedule,
	runtimeWorkerId?: string | null,
) => {
	// 0 also immediately returns which is good as the empty "keep latest" field in the UI
	// is saved as 0 in the database
	if (!backup.keepLatestCount) return;

	try {
		const destination = await findDestinationById(backup.destinationId);
		const rcloneFlags = getS3Credentials(destination);
		const s3Env = getS3CredentialEnv(destination);
		const appName = getServiceAppName(backup);
		const backupFilesPath = `:s3:${destination.bucket}/${appName}/${normalizeS3Path(backup.prefix)}`;

		// --include "*.bson.gz" or "*.sql.gz" or "*.zip" ensures nothing else other than the docklands backup files are touched by rclone
		// --format "tp" emits "<modtime>;<path>" so we can prune by real object
		// modification time rather than by filename. Filenames happen to be
		// ISO-timestamp-prefixed, but relying on that meant an out-of-band file
		// (or any non-timestamp name) could skew which backups were kept.
		const rcloneList = `${s3Env} rclone lsf ${rcloneFlags.join(" ")} --format "tp" --separator ";" --include "*${backup.databaseType === "web-server" ? ".zip" : ".{sql.gz,bson.gz}"}" ${backupFilesPath}`;
		// Sort by the modtime column descending (the leading fixed-width ISO
		// "YYYY-MM-DD HH:MM:SS" makes a plain `sort -r` order by real mtime), drop
		// the newest keepLatestCount rows, then recover the path after the ";"
		// separator so only the stale backups are passed to delete.
		const sortAndPickUnwantedBackups = `sort -r | tail -n +$((${backup.keepLatestCount}+1)) | cut -d";" -f2- | xargs -I{}`;
		// this command deletes the files
		// to test the deletion before actually deleting we can add --dry-run before ${backupFilesPath}{}
		const rcloneDelete = `${s3Env} rclone delete ${rcloneFlags.join(" ")} ${backupFilesPath}{}`;

		const rcloneCommand = `${rcloneList} | ${sortAndPickUnwantedBackups} ${rcloneDelete}`;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, rcloneCommand);
		} else {
			await execAsync(rcloneCommand);
		}

		logger.info(
			{ appName, kept: backup.keepLatestCount },
			"Backup retention enforced",
		);
	} catch (error) {
		// A retention failure must not fail the backup, but it must not be
		// swallowed silently either — stale files would accumulate unnoticed.
		logger.warn(
			{
				err: error,
				appName: getServiceAppName(backup),
				redactedError: redactRcloneCredentials(String(error)),
			},
			"Backup retention pruning failed",
		);
	}
};
