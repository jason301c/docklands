import path from "node:path";
import { scheduledJobs, scheduleJob } from "node-schedule";
import { paths } from "@/server/core/constants/paths";
import {
	createDeploymentVolumeBackup,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { findDestinationById } from "@/server/core/services/destination";
import { findVolumeBackupById } from "@/server/core/services/volume-backups";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import {
	getS3CredentialEnv,
	getS3Credentials,
	normalizeS3Path,
} from "../backups/utils";
import { sendVolumeBackupNotifications } from "../notifications/volume-backup";
import { backupVolume, getVolumeServiceAppName } from "./backup";

// Helper functions to extract workspace info from volume backup
const getProjectName = (
	volumeBackup: Awaited<ReturnType<typeof findVolumeBackupById>>,
): string => {
	const services = [
		volumeBackup.application,
		volumeBackup.compose,
		volumeBackup.database,
	];

	for (const service of services) {
		if (service?.environment?.workspace?.name) {
			return service.environment.workspace.name;
		}
	}

	return "Unknown Workspace";
};

const getOrganizationId = (
	volumeBackup: Awaited<ReturnType<typeof findVolumeBackupById>>,
): string => {
	const services = [
		volumeBackup.application,
		volumeBackup.compose,
		volumeBackup.database,
	];

	for (const service of services) {
		if (service?.environment?.workspace?.organizationId) {
			return service.environment.workspace.organizationId;
		}
	}

	return "";
};

export const scheduleVolumeBackup = async (volumeBackupId: string) => {
	const volumeBackup = await findVolumeBackupById(volumeBackupId);
	scheduleJob(volumeBackupId, volumeBackup.cronExpression, async () => {
		await runVolumeBackup(volumeBackupId);
	});
};

export const removeVolumeBackupJob = async (volumeBackupId: string) => {
	const currentJob = scheduledJobs[volumeBackupId];
	currentJob?.cancel();
};

const cleanupOldVolumeBackups = async (
	volumeBackup: Awaited<ReturnType<typeof findVolumeBackupById>>,
	runtimeWorkerId?: string | null,
) => {
	const { keepLatestCount, prefix, volumeName } = volumeBackup;
	const destination = await findDestinationById(volumeBackup.destinationId);

	if (!keepLatestCount) return;

	try {
		const rcloneFlags = getS3Credentials(destination);
		const s3Env = getS3CredentialEnv(destination);
		const s3AppName = getVolumeServiceAppName(volumeBackup);
		const backupFilesPath = `:s3:${destination.bucket}/${s3AppName}/${normalizeS3Path(prefix || "")}`;
		const listCommand = `${s3Env} rclone lsf ${rcloneFlags.join(" ")} --include "${volumeName}-*.tar" ${backupFilesPath}`;
		const sortAndPick = `sort -r | tail -n +$((${keepLatestCount}+1)) | xargs -I{}`;
		const deleteCommand = `${s3Env} rclone delete ${rcloneFlags.join(" ")} ${backupFilesPath}{}`;
		const fullCommand = `${listCommand} | ${sortAndPick} ${deleteCommand}`;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, fullCommand);
		} else {
			await execAsync(fullCommand);
		}
	} catch (error) {
		console.error("Volume backup retention error", error);
	}
};

export const runVolumeBackup = async (volumeBackupId: string) => {
	const volumeBackup = await findVolumeBackupById(volumeBackupId);
	const runtimeWorkerId =
		volumeBackup.application?.runtimeWorkerId ||
		volumeBackup.compose?.runtimeWorkerId;
	const deployment = await createDeploymentVolumeBackup({
		volumeBackupId: volumeBackup.volumeBackupId,
		title: "Volume Backup",
		description: "Volume Backup",
	});
	const projectName = getProjectName(volumeBackup);
	const organizationId = getOrganizationId(volumeBackup);
	try {
		const command = await backupVolume(volumeBackup);

		const commandWithLog = `(${command}) >> ${deployment.logPath} 2>&1`;
		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, commandWithLog);
		} else {
			await execAsync(commandWithLog);
		}

		if (volumeBackup.keepLatestCount && volumeBackup.keepLatestCount > 0) {
			await cleanupOldVolumeBackups(volumeBackup, runtimeWorkerId);
		}

		await updateDeploymentStatus(deployment.deploymentId, "done");

		// Map service type to match notification function expectations
		const mappedServiceType =
			volumeBackup.serviceType === "mongo"
				? "mongodb"
				: volumeBackup.serviceType;

		try {
			await sendVolumeBackupNotifications({
				projectName,
				applicationName: volumeBackup.name,
				volumeName: volumeBackup.volumeName,
				serviceType: mappedServiceType,
				type: "success",
				organizationId,
			});
		} catch (notificationError) {
			console.error(
				"Failed to send volume backup success notification",
				notificationError,
			);
		}
	} catch (error) {
		const { VOLUME_BACKUPS_PATH } = paths(!!runtimeWorkerId);
		const volumeBackupPath = path.join(
			VOLUME_BACKUPS_PATH,
			volumeBackup.appName,
		);
		// delete all the .tar files
		const command = `rm -rf ${volumeBackupPath}/*.tar`;
		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
		await updateDeploymentStatus(deployment.deploymentId, "error");

		// Send error notification
		const mappedServiceType =
			volumeBackup.serviceType === "mongo"
				? "mongodb"
				: volumeBackup.serviceType;

		try {
			await sendVolumeBackupNotifications({
				projectName,
				applicationName: volumeBackup.name,
				volumeName: volumeBackup.volumeName,
				serviceType: mappedServiceType,
				type: "error",
				organizationId,
				errorMessage: error instanceof Error ? error.message : String(error),
			});
		} catch (notificationError) {
			console.error(
				"Failed to send volume backup error notification",
				notificationError,
			);
		}
	}
};
