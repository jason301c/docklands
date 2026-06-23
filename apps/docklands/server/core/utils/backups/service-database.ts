import {
	databaseBackupCommand,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import type { BackupSchedule } from "@/server/core/services/backup";
import {
	createDeploymentBackup,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { findDestinationById } from "@/server/core/services/destination";
import type { findServiceDatabaseById } from "@/server/core/services/service-database";
import { logger } from "../../lib/logger";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { redactRcloneCredentials } from "./redact";
import {
	buildBackupShellCommand,
	getBackupTimestamp,
	getComposeContainerCommand,
	getS3Credentials,
	normalizeS3Path,
} from "./utils";

type ServiceDatabaseNested = Awaited<
	ReturnType<typeof findServiceDatabaseById>
>;

const buildServiceDatabaseBackupCommand = (
	database: ServiceDatabaseNested,
	databaseName: string,
): string => {
	const config = parseDatabaseConfig(database.engine, database.config);
	const databaseUser =
		"databaseUser" in config ? (config.databaseUser as string) : "";
	const databasePassword =
		"databaseRootPassword" in config &&
		(database.engine === "mysql" || database.engine === "mariadb")
			? ((config as { databaseRootPassword?: string }).databaseRootPassword ??
				"")
			: "databasePassword" in config
				? ((config as { databasePassword?: string }).databasePassword ?? "")
				: "";

	const command = databaseBackupCommand(database.engine, {
		database: databaseName,
		databaseUser,
		databasePassword,
	});
	if (!command) {
		throw new Error(
			`Database engine does not support logical backups: ${database.engine}`,
		);
	}
	return command;
};

/**
 * Backup runner for a compose-embedded database (`service_database`). Mirrors
 * `runDatabaseBackup`, but resolves the container inside the owning compose
 * stack by service name (Coolify's `ServiceDatabase` backup pattern).
 */
export const runServiceDatabaseBackup = async (
	database: ServiceDatabaseNested,
	backup: BackupSchedule,
) => {
	const { compose, serviceName, engine } = database;
	const workspace = compose.environment.workspace;
	const runtimeWorkerId = compose.runtimeWorkerId;

	const deployment = await createDeploymentBackup({
		backupId: backup.backupId,
		title: "Initializing Backup",
		description: "Initializing Backup",
	});

	const { prefix } = backup;
	const destination = await findDestinationById(backup.destinationId);
	const backupFileName = `${getBackupTimestamp()}.${
		engine === "mongo" ? "bson" : "sql"
	}.gz`;
	const bucketDestination = `${compose.appName}/${serviceName}/${normalizeS3Path(
		prefix,
	)}${backupFileName}`;

	try {
		const rcloneFlags = getS3Credentials(destination);
		const rcloneDestination = `:s3:${destination.bucket}/${bucketDestination}`;
		const rcloneCommand = `rclone rcat ${rcloneFlags.join(" ")} "${rcloneDestination}"`;

		const containerSearch = getComposeContainerCommand(
			compose.appName,
			serviceName,
			compose.composeType,
		);
		const backupCommand = buildServiceDatabaseBackupCommand(
			database,
			backup.database,
		);

		logger.info(
			{
				containerSearch,
				backupCommand,
				rcloneCommand: redactRcloneCredentials(rcloneCommand),
				logPath: deployment.logPath,
			},
			`Executing backup command: ${engine} service database`,
		);

		const command = buildBackupShellCommand(
			containerSearch,
			backupCommand,
			rcloneCommand,
			deployment.logPath,
		);

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command, { shell: "/bin/bash" });
		}

		await updateDeploymentStatus(deployment.deploymentId, "done");
	} catch (error) {
		await updateDeploymentStatus(deployment.deploymentId, "error");
		throw error;
	}

	return workspace.organizationId;
};
