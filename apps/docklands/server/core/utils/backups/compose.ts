import { createLogger } from "@/server/core/lib/logger";
import type { BackupSchedule } from "@/server/core/services/backup";
import type { Compose } from "@/server/core/services/compose";
import {
	createDeploymentBackup,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { findDestinationById } from "@/server/core/services/destination";
import { findEnvironmentById } from "@/server/core/services/environment";
import { findWorkspaceById } from "@/server/core/services/workspace";
import { sendDatabaseBackupNotifications } from "../notifications/database-backup";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { redactRcloneCredentials } from "./redact";
import {
	getBackupCommand,
	getBackupTimestamp,
	getS3CredentialEnv,
	getS3Credentials,
	normalizeS3Path,
} from "./utils";

const logger = createLogger("backup");

export const runComposeBackup = async (
	compose: Compose,
	backup: BackupSchedule,
) => {
	const { environmentId, name, appName } = compose;
	const environment = await findEnvironmentById(environmentId);
	const workspace = await findWorkspaceById(environment.workspaceId);
	const { prefix, databaseType, serviceName } = backup;
	const destination = await findDestinationById(backup.destinationId);
	const backupFileName = `${getBackupTimestamp()}.${databaseType === "mongo" ? "bson" : "sql"}.gz`;
	const s3AppName = serviceName ? `${appName}_${serviceName}` : appName;
	const bucketDestination = `${s3AppName}/${normalizeS3Path(prefix)}${backupFileName}`;
	const deployment = await createDeploymentBackup({
		backupId: backup.backupId,
		title: "Compose Backup",
		description: "Compose Backup",
	});

	logger.info(
		{ appName, databaseType, bucketDestination, backupId: backup.backupId },
		"Compose backup started",
	);

	try {
		const rcloneFlags = getS3Credentials(destination);
		const s3Env = getS3CredentialEnv(destination);
		const rcloneDestination = `:s3:${destination.bucket}/${bucketDestination}`;
		const rcloneCommand = `${s3Env} rclone rcat ${rcloneFlags.join(" ")} "${rcloneDestination}"`;

		const backupCommand = getBackupCommand(
			backup,
			rcloneCommand,
			deployment.logPath,
		);
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, backupCommand);
		} else {
			await execAsync(backupCommand, {
				shell: "/bin/bash",
			});
		}

		logger.info(
			{ appName, databaseType, backupId: backup.backupId },
			"Compose backup completed",
		);

		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: workspace.name,
			databaseType: getDatabaseType(databaseType),
			type: "success",
			organizationId: workspace.organizationId,
			databaseName: backup.database,
		});

		await updateDeploymentStatus(deployment.deploymentId, "done");
	} catch (error) {
		logger.error(
			{
				err: error,
				appName,
				databaseType,
				backupId: backup.backupId,
				rcloneDestination: redactRcloneCredentials(
					`:s3:${destination.bucket}/${bucketDestination}`,
				),
			},
			"Compose backup failed",
		);
		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: workspace.name,
			databaseType: getDatabaseType(databaseType),
			type: "error",
			errorMessage:
				error instanceof Error ? error.message : "Error message not provided",
			organizationId: workspace.organizationId,
			databaseName: backup.database,
		});

		await updateDeploymentStatus(deployment.deploymentId, "error");
		throw error;
	}
};

const getDatabaseType = (databaseType: BackupSchedule["databaseType"]) => {
	if (databaseType === "mongo") {
		return "mongodb";
	}
	if (databaseType === "postgres") {
		return "postgres";
	}
	if (databaseType === "mariadb") {
		return "mariadb";
	}
	if (databaseType === "mysql") {
		return "mysql";
	}
	return "mongodb";
};
