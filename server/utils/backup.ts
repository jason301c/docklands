import { scheduledJobs, scheduleJob as scheduleNodeJob } from "node-schedule";
import {
	type BackupScheduleList,
	findBackupById,
} from "@/server/core/services/backup";
import { findScheduleById } from "@/server/core/services/schedule";
import { findServerById } from "@/server/core/services/server";
import {
	removeScheduleBackup,
	scheduleBackup,
} from "@/server/core/utils/backups/utils";
import {
	removeScheduleJob,
	scheduleJob as scheduleDocklandsJob,
} from "@/server/core/utils/schedules/utils";
import {
	removeVolumeBackupJob,
	scheduleVolumeBackup,
} from "@/server/core/utils/volume-backups/utils";
import { cleanupAll } from "@/server/core/utils/docker/utils";
import { sendDockerCleanupNotifications } from "@/server/core/utils/notifications/docker-cleanup";

type QueueJob =
	| {
			type: "backup";
			cronSchedule: string;
			backupId: string;
	  }
	| {
			type: "server";
			cronSchedule: string;
			serverId: string;
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
	job: Extract<QueueJob, { type: "server" }>,
) => {
	const server = await findServerById(job.serverId);
	scheduleNodeJob(job.serverId, job.cronSchedule, async () => {
		console.log(`Docker Cleanup ${new Date().toLocaleString()}] Running...`);
		await cleanupAll(job.serverId);
		await sendDockerCleanupNotifications(server.organizationId);
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

	scheduledJobs[job.serverId]?.cancel();
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
