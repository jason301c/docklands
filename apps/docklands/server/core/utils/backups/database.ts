import {
	databaseBackupCommand,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import type { BackupSchedule } from "@/server/core/services/backup";
import type { Database } from "@/server/core/services/database";
import {
	createDeploymentBackup,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { findDestinationById } from "@/server/core/services/destination";
import { findEnvironmentById } from "@/server/core/services/environment";
import { findWorkspaceById } from "@/server/core/services/workspace";
import { logger } from "../../lib/logger";
import { sendDatabaseBackupNotifications } from "../notifications/database-backup";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { redactRcloneCredentials } from "./redact";
import {
	buildBackupShellCommand,
	getBackupTimestamp,
	getS3CredentialEnv,
	getS3Credentials,
	getServiceContainerCommand,
	normalizeS3Path,
} from "./utils";

/** Notification "databaseType" label expected by the notification subsystem. */
const notificationDatabaseType = (
	engine: Database["engine"],
): "postgres" | "mysql" | "mongodb" | "mariadb" | "libsql" => {
	if (engine === "mongo") return "mongodb";
	if (engine === "redis") {
		// Redis has no logical dump backup, but keep a stable label just in case.
		return "postgres";
	}
	return engine;
};

/**
 * Build the inner backup (dump) command for a managed database from its engine
 * and parsed credentials. Mirrors the old per-engine `generateBackupCommand`
 * branches, but sourced from the unified `database` table via the registry.
 */
const buildDatabaseBackupCommand = (
	database: Database,
	databaseName: string,
): string => {
	const config = parseDatabaseConfig(database.engine, database.config);

	const databaseUser =
		"databaseUser" in config ? (config.databaseUser as string) : "";
	// MySQL/MariaDB dumps run as root; the registry's command selects the right
	// password per engine, so pass root password where present, falling back to
	// the regular password.
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
 * Generic database backup runner. Replaces the six per-engine runners
 * (`runPostgresBackup`, `runMySqlBackup`, ...). Preserves the exact exec /
 * rclone / S3 upload / gzip / notification behavior; only the data source (the
 * unified `database` table) and the dispatch (by `engine`) changed.
 */
export const runDatabaseBackup = async (
	database: Database,
	backup: BackupSchedule,
) => {
	const { name, environmentId, appName, runtimeWorkerId, engine } = database;
	const environment = await findEnvironmentById(environmentId);
	const workspace = await findWorkspaceById(environment.workspaceId);

	const deployment = await createDeploymentBackup({
		backupId: backup.backupId,
		title: "Initializing Backup",
		description: "Initializing Backup",
	});

	const { prefix } = backup;
	const destination = await findDestinationById(backup.destinationId);
	// Mongo dumps are bson archives; everything else is a SQL gzip.
	const backupFileName = `${getBackupTimestamp()}.${
		engine === "mongo" ? "bson" : "sql"
	}.gz`;
	const bucketDestination = `${appName}/${normalizeS3Path(prefix)}${backupFileName}`;

	try {
		const rcloneFlags = getS3Credentials(destination);
		const s3Env = getS3CredentialEnv(destination);
		const rcloneDestination = `:s3:${destination.bucket}/${bucketDestination}`;
		const rcloneCommand = `${s3Env} rclone rcat ${rcloneFlags.join(" ")} "${rcloneDestination}"`;

		const containerSearch = getServiceContainerCommand(appName);
		const backupCommand = buildDatabaseBackupCommand(database, backup.database);

		logger.info(
			{
				databaseId: database.databaseId,
				backupId: backup.backupId,
				appName,
				engine,
			},
			"Database backup started",
		);

		logger.info(
			{
				containerSearch,
				backupCommand,
				rcloneCommand: redactRcloneCredentials(rcloneCommand),
				logPath: deployment.logPath,
			},
			`Executing backup command: ${engine} database`,
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
			await execAsync(command, {
				shell: "/bin/bash",
			});
		}

		logger.info(
			{
				databaseId: database.databaseId,
				backupId: backup.backupId,
				appName,
				engine,
			},
			"Database backup completed",
		);

		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: workspace.name,
			databaseType: notificationDatabaseType(engine),
			type: "success",
			organizationId: workspace.organizationId,
			databaseName: backup.database,
		});

		await updateDeploymentStatus(deployment.deploymentId, "done");
	} catch (error) {
		logger.error(
			{
				err: error,
				databaseId: database.databaseId,
				appName,
				engine,
				backupId: backup.backupId,
			},
			"Database backup failed",
		);
		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: workspace.name,
			databaseType: notificationDatabaseType(engine),
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
