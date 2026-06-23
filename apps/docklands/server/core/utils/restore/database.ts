import type { z } from "zod";
import { parseDatabaseConfig } from "@/server/core/databases/registry";
import type { apiRestoreBackup } from "@/server/core/db/schema";
import type { Database } from "@/server/core/services/database";
import type { Destination } from "@/server/core/services/destination";
import { getS3Credentials, getServiceContainerCommand } from "../backups/utils";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { getRestoreCommand } from "./utils";

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
		const config = parseDatabaseConfig(engine, database.config);

		const rcloneFlags = getS3Credentials(destination);
		const bucketPath = `:s3:${destination.bucket}`;
		const backupPath = `${bucketPath}/${backupInput.backupFile}`;

		let command: string;

		if (engine === "libsql") {
			// libSQL restores by untarring the gzip archive into /var/lib/sqld.
			const rcloneCommand = `rclone cat ${rcloneFlags.join(" ")} "${backupPath}"`;
			const containerSearch = getServiceContainerCommand(appName);
			const restoreCommand = `docker exec -i $CONTAINER_ID sh -c "tar xzf - -C /var/lib/sqld"`;
			command = `CONTAINER_ID=$(${containerSearch}) && ${rcloneCommand} | ${restoreCommand}`;

			emit("Starting restore...");
			emit(`Restoring libsql from ${backupInput.backupFile}`);
		} else if (engine === "mongo") {
			const rcloneCommand = `rclone copy ${rcloneFlags.join(" ")} "${backupPath}"`;
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
			const rcloneCommand = `rclone cat ${rcloneFlags.join(" ")} "${backupPath}" | gunzip`;
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

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}

		emit("Restore completed successfully!");
	} catch (error) {
		console.error(error);
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
