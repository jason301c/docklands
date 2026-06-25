import { quote } from "shell-quote";
import type { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import {
	databaseBackupCommand,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import type { apiRestoreBackup } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import type { Database } from "@/server/core/services/database";
import type { Destination } from "@/server/core/services/destination";
import {
	getBackupTimestamp,
	getS3CredentialEnv,
	getS3Credentials,
	getServiceContainerCommand,
} from "../backups/utils";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { getRestoreCommand } from "./utils";

const logger = createLogger("restore");

/**
 * Build a command that snapshots the *current* database to a local file before a
 * destructive restore overwrites it, so there's a recovery point if the restore
 * is wrong/corrupt. Returns null for engines we can't snapshot. Mirrors the
 * backup dump's per-engine auth (mysql/mariadb dump as root).
 */
const buildPreRestoreSnapshotCommand = (
	database: Database,
	databaseName: string,
): { command: string; file: string } | null => {
	const { appName, engine, runtimeWorkerId } = database;
	const config = parseDatabaseConfig(engine, database.config);
	const { BASE_PATH } = paths(!!runtimeWorkerId);
	const dir = `${BASE_PATH}/pre-restore-snapshots`;
	const containerSearch = getServiceContainerCommand(appName);
	const stamp = getBackupTimestamp();

	if (engine === "libsql") {
		const file = `${dir}/${appName}-${stamp}.tar.gz`;
		const command = `mkdir -p "${dir}" && CONTAINER_ID=$(${containerSearch}) && docker exec -i $CONTAINER_ID sh -c "tar czf - -C /var/lib/sqld ." > "${file}"`;
		return { command, file };
	}

	const dumpCommand = databaseBackupCommand(engine, {
		database: databaseName,
		databaseUser: "databaseUser" in config ? config.databaseUser : "",
		// mysql/mariadb dumps authenticate as root (the registry stores the root
		// password); postgres/mongo use the regular password.
		databasePassword:
			engine === "mysql" || engine === "mariadb"
				? "databaseRootPassword" in config
					? config.databaseRootPassword
					: ""
				: "databasePassword" in config
					? config.databasePassword
					: "",
	});
	if (!dumpCommand) return null;

	const ext = engine === "mongo" ? "archive.gz" : "sql.gz";
	const file = `${dir}/${appName}-${stamp}.${ext}`;
	const command = `mkdir -p "${dir}" && CONTAINER_ID=$(${containerSearch}) && ${dumpCommand} > "${file}"`;
	return { command, file };
};

/**
 * Generic database restore runner. Replaces the five per-engine restore runners
 * (`restorePostgresBackup`, `restoreMySqlBackup`, ...). Loads credentials from
 * the unified `database` table via the registry and dispatches the restore
 * command by `database.engine`. Preserves the exact rclone/gunzip/exec behavior
 * of the per-engine runners.
 */
export const restoreDatabaseBackup = async (
	database: Database,
	destination: Destination,
	backupInput: z.infer<typeof apiRestoreBackup>,
	emit: (log: string) => void,
) => {
	try {
		const { appName, runtimeWorkerId, engine } = database;

		logger.info(
			{ appName, engine, backupFile: backupInput.backupFile },
			"Database restore started",
		);

		const config = parseDatabaseConfig(engine, database.config);

		const rcloneFlags = getS3Credentials(destination);
		const s3Env = getS3CredentialEnv(destination);
		const bucketPath = `:s3:${destination.bucket}`;
		const backupPath = `${bucketPath}/${backupInput.backupFile}`;

		let command: string;

		if (engine === "libsql") {
			// libSQL restores by untarring the gzip archive into /var/lib/sqld.
			const rcloneCommand = `${s3Env} rclone cat ${rcloneFlags.join(" ")} ${quote([backupPath])}`;
			const containerSearch = getServiceContainerCommand(appName);
			const restoreCommand = `docker exec -i $CONTAINER_ID sh -c "tar xzf - -C /var/lib/sqld"`;
			command = `CONTAINER_ID=$(${containerSearch}) && ${rcloneCommand} | ${restoreCommand}`;

			emit("Starting restore...");
			emit(`Restoring libsql from ${backupInput.backupFile}`);
		} else if (engine === "mongo") {
			const rcloneCommand = `${s3Env} rclone copy ${rcloneFlags.join(" ")} ${quote([backupPath])}`;
			command = getRestoreCommand({
				appName,
				type: "mongo",
				credentials: {
					database: backupInput.databaseName,
					databaseUser: "databaseUser" in config ? config.databaseUser : "",
					databasePassword:
						"databasePassword" in config ? config.databasePassword : "",
				},
				restoreType: "database",
				rcloneCommand,
				backupFile: backupInput.backupFile,
			});

			emit("Starting restore...");
			emit(
				`Restoring database: ${backupInput.databaseName} from ${backupInput.backupFile}`,
			);
		} else if (
			engine === "postgres" ||
			engine === "mysql" ||
			engine === "mariadb"
		) {
			// postgres / mysql / mariadb: pipe a gunzipped SQL dump into the client.
			const rcloneCommand = `${s3Env} rclone cat ${rcloneFlags.join(" ")} ${quote([backupPath])} | gunzip`;
			const databaseUser = "databaseUser" in config ? config.databaseUser : "";
			// MySQL restores as root; the registry stores the root password.
			const databasePassword =
				engine === "mysql"
					? "databaseRootPassword" in config
						? config.databaseRootPassword
						: ""
					: "databasePassword" in config
						? config.databasePassword
						: "";

			command = getRestoreCommand({
				appName,
				type: engine,
				credentials: {
					database: backupInput.databaseName,
					databaseUser,
					databasePassword,
				},
				restoreType: "database",
				rcloneCommand,
			});

			emit("Starting restore...");
			emit(
				`Restoring database: ${backupInput.databaseName} from ${backupInput.backupFile}`,
			);
		} else {
			throw new Error(`Database engine does not support restore: ${engine}`);
		}

		// Take a pre-restore snapshot of the current data first — restore is
		// destructive (pg_restore --clean / mysql replay / mongorestore --drop)
		// and applies to the live database. Best-effort: if it fails we warn and
		// continue rather than block the restore the user explicitly requested.
		const snapshot = buildPreRestoreSnapshotCommand(
			database,
			backupInput.databaseName,
		);
		if (snapshot) {
			emit("Taking a pre-restore snapshot of the current database…");
			try {
				if (runtimeWorkerId) {
					await execAsyncRemote(runtimeWorkerId, snapshot.command);
				} else {
					await execAsync(snapshot.command);
				}
				emit(
					`Pre-restore snapshot saved to ${snapshot.file} — delete it once you've verified the restore.`,
				);
			} catch (snapshotError) {
				logger.warn(
					{ err: snapshotError, appName, engine },
					"Pre-restore snapshot failed",
				);
				emit(
					`⚠️ Could not take a pre-restore snapshot (${
						snapshotError instanceof Error
							? snapshotError.message
							: "unknown error"
					}). Continuing — the current data will be overwritten with no automatic recovery point.`,
				);
			}
		}

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}

		logger.info({ appName, engine }, "Database restore completed");
		emit("Restore completed successfully!");
	} catch (error) {
		logger.error(
			{
				err: error,
				appName: database.appName,
				engine: database.engine,
				backupFile: backupInput.backupFile,
			},
			"Database backup restore failed",
		);
		emit(
			`Error: ${
				error instanceof Error
					? error.message
					: "Error restoring database backup"
			}`,
		);
		throw error;
	}
};
