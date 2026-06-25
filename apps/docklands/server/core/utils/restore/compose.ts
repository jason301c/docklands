import { quote } from "shell-quote";
import type { z } from "zod";
import type { apiRestoreBackup } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import type { Compose } from "@/server/core/services/compose";
import type { Destination } from "@/server/core/services/destination";
import { getS3CredentialEnv, getS3Credentials } from "../backups/utils";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { getRestoreCommand } from "./utils";

const logger = createLogger("restore");

interface DatabaseCredentials {
	databaseUser?: string;
	databasePassword?: string;
}

export const restoreComposeBackup = async (
	compose: Compose,
	destination: Destination,
	backupInput: z.infer<typeof apiRestoreBackup>,
	emit: (log: string) => void,
) => {
	try {
		if (backupInput.databaseType === "web-server") {
			logger.warn(
				{ databaseType: backupInput.databaseType },
				"Compose restore called with web-server type; skipping",
			);
			return;
		}
		const { runtimeWorkerId, appName, composeType } = compose;

		const rcloneFlags = getS3Credentials(destination);
		const s3Env = getS3CredentialEnv(destination);
		const bucketPath = `:s3:${destination.bucket}`;
		const backupPath = `${bucketPath}/${backupInput.backupFile}`;
		let rcloneCommand = `${s3Env} rclone cat ${rcloneFlags.join(" ")} ${quote([backupPath])} | gunzip`;

		if (backupInput.metadata?.mongo) {
			rcloneCommand = `${s3Env} rclone copy ${rcloneFlags.join(" ")} ${quote([backupPath])}`;
		}

		let credentials: DatabaseCredentials = {};

		switch (backupInput.databaseType) {
			case "postgres":
				credentials = {
					databaseUser: backupInput.metadata?.postgres?.databaseUser,
				};
				break;
			case "mariadb":
				credentials = {
					databaseUser: backupInput.metadata?.mariadb?.databaseUser,
					databasePassword: backupInput.metadata?.mariadb?.databasePassword,
				};
				break;
			case "mysql":
				credentials = {
					databasePassword: backupInput.metadata?.mysql?.databaseRootPassword,
				};
				break;
			case "mongo":
				credentials = {
					databaseUser: backupInput.metadata?.mongo?.databaseUser,
					databasePassword: backupInput.metadata?.mongo?.databasePassword,
				};
				break;
		}

		const restoreCommand = getRestoreCommand({
			appName: appName,
			serviceName: backupInput.metadata?.serviceName,
			type: backupInput.databaseType as
				| "postgres"
				| "mariadb"
				| "mysql"
				| "mongo",
			credentials: {
				database: backupInput.databaseName,
				...credentials,
			},
			restoreType: composeType,
			rcloneCommand,
			backupFile: backupInput.backupFile,
		});

		logger.info(
			{ appName, databaseType: backupInput.databaseType },
			"Compose backup restore started",
		);

		emit("Starting restore...");
		emit(
			`Restoring database: ${backupInput.databaseName} from ${backupInput.backupFile}`,
		);

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, restoreCommand);
		} else {
			await execAsync(restoreCommand);
		}

		logger.info({ appName }, "Compose backup restore completed");
		emit("Restore completed successfully!");
	} catch (error) {
		logger.error(
			{
				err: error,
				appName: compose.appName,
				databaseType: backupInput.databaseType,
			},
			"Compose backup restore failed",
		);
		emit(
			`Error: ${
				error instanceof Error ? error.message : "Error restoring mongo backup"
			}`,
		);
		throw new Error("Error restoring compose backup", { cause: error });
	}
};
