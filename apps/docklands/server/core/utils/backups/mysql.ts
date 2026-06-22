import type { BackupSchedule } from "@/server/core/services/backup";
import {
	createDeploymentBackup,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { findDestinationById } from "@/server/core/services/destination";
import { findEnvironmentById } from "@/server/core/services/environment";
import type { MySql } from "@/server/core/services/mysql";
import { findWorkspaceById } from "@/server/core/services/workspace";
import { sendDatabaseBackupNotifications } from "../notifications/database-backup";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import {
	getBackupCommand,
	getBackupTimestamp,
	getS3Credentials,
	normalizeS3Path,
} from "./utils";

export const runMySqlBackup = async (mysql: MySql, backup: BackupSchedule) => {
	const { environmentId, name, appName } = mysql;
	const environment = await findEnvironmentById(environmentId);
	const workspace = await findWorkspaceById(environment.workspaceId);
	const { prefix } = backup;
	const destination = await findDestinationById(backup.destinationId);
	const backupFileName = `${getBackupTimestamp()}.sql.gz`;
	const bucketDestination = `${appName}/${normalizeS3Path(prefix)}${backupFileName}`;
	const deployment = await createDeploymentBackup({
		backupId: backup.backupId,
		title: "MySQL Backup",
		description: "MySQL Backup",
	});

	try {
		const rcloneFlags = getS3Credentials(destination);
		const rcloneDestination = `:s3:${destination.bucket}/${bucketDestination}`;

		const rcloneCommand = `rclone rcat ${rcloneFlags.join(" ")} "${rcloneDestination}"`;

		const backupCommand = getBackupCommand(
			backup,
			rcloneCommand,
			deployment.logPath,
		);

		if (mysql.runtimeWorkerId) {
			await execAsyncRemote(mysql.runtimeWorkerId, backupCommand);
		} else {
			await execAsync(backupCommand, {
				shell: "/bin/bash",
			});
		}
		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: workspace.name,
			databaseType: "mysql",
			type: "success",
			organizationId: workspace.organizationId,
			databaseName: backup.database,
		});
		await updateDeploymentStatus(deployment.deploymentId, "done");
	} catch (error) {
		console.log(error);
		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: workspace.name,
			databaseType: "mysql",
			type: "error",
			// @ts-expect-error
			errorMessage: error?.message || "Error message not provided",
			organizationId: workspace.organizationId,
			databaseName: backup.database,
		});
		await updateDeploymentStatus(deployment.deploymentId, "error");
		throw error;
	}
};
