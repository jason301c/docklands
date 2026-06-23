import { eq } from "drizzle-orm";
import { scheduleJob } from "node-schedule";
import { CLEANUP_CRON_JOB } from "@/server/core/constants/cleanup";
import { member } from "@/server/core/db/schema";
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
import { getS3Credentials, normalizeS3Path, scheduleBackup } from "./utils";

export const initCronJobs = async () => {
	console.log("Setting up cron jobs....");

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
				console.log(
					`Docker Cleanup ${new Date().toLocaleString()}]  Running docker cleanup`,
				);

				await cleanupAll();

				await sendDockerCleanupNotifications(admin.user.id);
			});
		} catch (error) {
			console.error("[Backup] Docker Cleanup Error", error);
		}
	}

	const servers = await getAllRuntimeWorkers();

	for (const runtimeWorker of servers) {
		const { runtimeWorkerId, enableDockerCleanup, name } = runtimeWorker;
		if (enableDockerCleanup) {
			try {
				scheduleJob(runtimeWorkerId, CLEANUP_CRON_JOB, async () => {
					console.log(
						`SERVER-BACKUP[${new Date().toLocaleString()}] Running Cleanup ${name}`,
					);

					await cleanupAll(runtimeWorkerId);

					await sendDockerCleanupNotifications(
						admin.user.id,
						`Docker cleanup for Server ${name} (${runtimeWorkerId})`,
					);
				});
			} catch (error) {
				console.error(`[Backup] ${error}`);
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
				console.log(
					`[Backup] ${backup.databaseType} Enabled with cron: [${backup.schedule}]`,
				);
			}
		} catch (error) {
			console.error(`[Backup] ${backup.databaseType} Error`, error);
		}
	}

	if (webServerSettings?.logCleanupCron) {
		try {
			console.log(
				"Starting log requests cleanup",
				webServerSettings.logCleanupCron,
			);
			await startLogCleanup(webServerSettings.logCleanupCron);
		} catch (error) {
			console.error("[Backup] Log Cleanup Error", error);
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
		const appName = getServiceAppName(backup);
		const backupFilesPath = `:s3:${destination.bucket}/${appName}/${normalizeS3Path(backup.prefix)}`;

		// --include "*.bson.gz" or "*.sql.gz" or "*.zip" ensures nothing else other than the docklands backup files are touched by rclone
		const rcloneList = `rclone lsf ${rcloneFlags.join(" ")} --include "*${backup.databaseType === "web-server" ? ".zip" : ".{sql.gz,bson.gz}"}" ${backupFilesPath}`;
		// when we pipe the above command with this one, we only get the list of files we want to delete
		const sortAndPickUnwantedBackups = `sort -r | tail -n +$((${backup.keepLatestCount}+1)) | xargs -I{}`;
		// this command deletes the files
		// to test the deletion before actually deleting we can add --dry-run before ${backupFilesPath}{}
		const rcloneDelete = `rclone delete ${rcloneFlags.join(" ")} ${backupFilesPath}{}`;

		const rcloneCommand = `${rcloneList} | ${sortAndPickUnwantedBackups} ${rcloneDelete}`;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, rcloneCommand);
		} else {
			await execAsync(rcloneCommand);
		}
	} catch (error) {
		console.error(redactRcloneCredentials(String(error)));
	}
};
