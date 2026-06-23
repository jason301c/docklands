import { scheduledJobs, scheduleJob as scheduleNodeJob } from "node-schedule";
import { createLogger } from "@/server/core/lib/logger";
import {
	type BackupScheduleList,
	findBackupById,
} from "@/server/core/services/backup";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { findScheduleById } from "@/server/core/services/schedule";
import {
	removeScheduleBackup,
	scheduleBackup,
} from "@/server/core/utils/backups/utils";
import { cleanupAll } from "@/server/core/utils/docker/utils";
import { sendDockerCleanupNotifications } from "@/server/core/utils/notifications/docker-cleanup";
import {
	removeScheduleJob,
	scheduleJob as scheduleDocklandsJob,
} from "@/server/core/utils/schedules/utils";
import {
	removeVolumeBackupJob,
	scheduleVolumeBackup,
} from "@/server/core/utils/volume-backups/utils";

const logger = createLogger("backup-schedule");

type QueueJob =
	| {
			type: "backup";
			cronSchedule: string;
			backupId: string;
	  }
	| {
			type: "runtimeWorker";
			cronSchedule: string;
			runtimeWorkerId: string;
	  }
	| {
			type: "schedule";
			cronSchedule: string;
			scheduleId: string;
			timezone?: string | null;
	  }
	| {
			type: "volume-backup";
			cronSchedule: string;
			volumeBackupId: string;
	  };

const scheduleServerCleanup = async (
	job: Extract<QueueJob, { type: "runtimeWorker" }>,
) => {
	const runtimeWorker = await findRuntimeWorkerById(job.runtimeWorkerId);
	scheduleNodeJob(job.runtimeWorkerId, job.cronSchedule, async () => {
		logger.info(
			{ runtimeWorkerId: job.runtimeWorkerId },
			"Docker cleanup job running",
		);
		try {
			await cleanupAll(job.runtimeWorkerId);
			await sendDockerCleanupNotifications(runtimeWorker.organizationId);
			logger.info(
				{ runtimeWorkerId: job.runtimeWorkerId },
				"Docker cleanup job completed",
			);
		} catch (err) {
			logger.error(
				{ err, runtimeWorkerId: job.runtimeWorkerId },
				"Docker cleanup job failed",
			);
		}
	});
};

export const schedule = async (job: QueueJob) => {
	if (job.type === "backup") {
		const backup = await findBackupById(job.backupId);
		scheduleBackup(backup);
		return true;
	}

	if (job.type === "schedule") {
		const currentSchedule = await findScheduleById(job.scheduleId);
		scheduleDocklandsJob(currentSchedule);
		return true;
	}

	if (job.type === "volume-backup") {
		await scheduleVolumeBackup(job.volumeBackupId);
		return true;
	}

	await scheduleServerCleanup(job);
	return true;
};

export const removeJob = async (job: QueueJob) => {
	if (job.type === "backup") {
		removeScheduleBackup(job.backupId);
		return true;
	}

	if (job.type === "schedule") {
		removeScheduleJob(job.scheduleId);
		return true;
	}

	if (job.type === "volume-backup") {
		removeVolumeBackupJob(job.volumeBackupId);
		return true;
	}

	scheduledJobs[job.runtimeWorkerId]?.cancel();
	return true;
};

export const updateJob = async (job: QueueJob) => {
	await removeJob(job);
	return schedule(job);
};

export const cancelJobs = async (backups: BackupScheduleList) => {
	for (const backup of backups) {
		if (backup.enabled) {
			removeScheduleBackup(backup.backupId);
		}
	}
};
