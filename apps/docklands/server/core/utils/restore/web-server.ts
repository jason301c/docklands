import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { quote } from "shell-quote";
import { paths } from "@/server/core/constants/paths";
import { resolveEncryptionKey } from "@/server/core/crypto/secret-box";
import { webServerRestoreBackupSchema } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import type { Destination } from "@/server/core/services/destination";
import {
	assertBundledPostgresForInstanceBackup,
	resolveBundledPostgresConnection,
} from "../backups/instance-backup-support";
import { getS3CredentialEnv, getS3Credentials } from "../backups/utils";
import { execAsync } from "../process/execAsync";

const logger = createLogger("restore");

const quotePostgresIdentifier = (value: string) =>
	`"${value.replace(/"/g, '""')}"`;

const quotePostgresLiteral = (value: string) =>
	`'${value.replace(/'/g, "''")}'`;

export const restoreWebServerBackupOffline = async (
	destination: Destination,
	backupFileInput: string,
	emit: (log: string) => void,
) => {
	const backupFile =
		webServerRestoreBackupSchema.shape.backupFile.parse(backupFileInput);
	try {
		const rcloneFlags = getS3Credentials(destination);
		const s3Env = getS3CredentialEnv(destination);
		const bucketPath = `:s3:${destination.bucket}`;
		const backupPath = `${bucketPath}/${backupFile}`;
		const localBackupFileName = posix.basename(backupFile);
		const { BASE_PATH } = paths();

		logger.info({ backupFile }, "Web server restore started");
		assertBundledPostgresForInstanceBackup();
		const postgres = resolveBundledPostgresConnection();

		// Create a temporary directory outside of BASE_PATH
		const tempDir = await mkdtemp(join(tmpdir(), "docklands-restore-"));

		try {
			emit("Starting restore...");
			emit(`Backup path: ${backupPath}`);
			emit(`Temp directory: ${tempDir}`);

			// Create temp directory
			emit("Creating temporary directory...");
			await execAsync(`mkdir -p ${quote([tempDir])}`);

			// Download backup from S3
			emit("Downloading backup from S3...");
			const localBackupPath = join(tempDir, localBackupFileName);
			await execAsync(
				`${s3Env} rclone copyto ${rcloneFlags.join(" ")} ${quote([backupPath])} ${quote([localBackupPath])}`,
			);

			// List files before extraction
			emit("Listing files before extraction...");
			const { stdout: beforeFiles } = await execAsync(
				`ls -la ${quote([tempDir])}`,
			);
			emit(`Files before extraction: ${beforeFiles}`);

			// Extract backup
			emit("Extracting backup...");
			await execAsync(
				`cd ${quote([tempDir])} && unzip ${quote([localBackupFileName])} > /dev/null 2>&1`,
			);

			// The archive bundles the encryption key the dump's secrets were sealed
			// with. If this instance's key differs, the restored secrets won't
			// decrypt — warn loudly (without ever revealing the key) so the operator
			// reconciles DOCKLANDS_ENCRYPTION_KEY before relying on the data.
			const secretsPath = join(tempDir, "docklands-secrets.env");
			const { stdout: hasSecrets } = await execAsync(
				`ls ${quote([secretsPath])} || true`,
			);
			if (hasSecrets.includes("docklands-secrets.env")) {
				try {
					const contents = await readFile(secretsPath, "utf8");
					const prefix = "DOCKLANDS_ENCRYPTION_KEY=";
					const backedUpKey = contents
						.split("\n")
						.find((line) => line.startsWith(prefix))
						?.slice(prefix.length)
						.trim();
					let currentKey: string | undefined;
					try {
						currentKey = resolveEncryptionKey();
					} catch {
						currentKey = undefined;
					}
					if (backedUpKey && currentKey && backedUpKey === currentKey) {
						emit(
							"Encryption key matches the backup — restored secrets will decrypt ✅",
						);
					} else {
						emit(
							"⚠️  This backup was sealed with a DIFFERENT DOCKLANDS_ENCRYPTION_KEY than this instance. Set DOCKLANDS_ENCRYPTION_KEY to the value in the backup's docklands-secrets.env and restart, or restored secrets (tokens, keys, passwords) will fail to decrypt.",
						);
					}
				} catch {
					// Best-effort guidance only.
				}
			}

			// Restore filesystem first
			emit("Restoring filesystem...");
			emit(`Copying from ${tempDir}/filesystem/* to ${BASE_PATH}/`);

			// First clean the target directory
			emit("Cleaning target directory...");
			await execAsync(`rm -rf ${quote([`${BASE_PATH}/`])}*`);

			// Ensure the target directory exists
			emit("Setting up target directory...");
			await execAsync(`mkdir -p ${quote([BASE_PATH])}`);

			// Copy files preserving permissions
			emit("Copying files...");
			await execAsync(
				`cp -rp ${quote([`${tempDir}/filesystem/`])}* ${quote([`${BASE_PATH}/`])}`,
			);

			// Now handle database restore
			emit("Starting database restore...");

			// Check if database.sql.gz exists and decompress it
			const { stdout: hasGzFile } = await execAsync(
				`ls ${quote([join(tempDir, "database.sql.gz")])} || true`,
			);
			if (hasGzFile.includes("database.sql.gz")) {
				emit("Found compressed database file, decompressing...");
				await execAsync(
					`cd ${quote([tempDir])} && gunzip ${quote(["database.sql.gz"])}`,
				);
			}

			// Verify database file exists
			const { stdout: hasSqlFile } = await execAsync(
				`ls ${quote([join(tempDir, "database.sql")])} || true`,
			);
			if (!hasSqlFile.includes("database.sql")) {
				throw new Error("Database file not found after extraction");
			}

			const { stdout: postgresContainer } = await execAsync(
				`docker ps --filter "name=docklands-postgres" --filter "status=running" -q | head -n 1`,
			);

			if (!postgresContainer) {
				throw new Error("Docklands Postgres container not found");
			}

			const postgresContainerId = postgresContainer.trim();
			const postgresContainerIdArg = quote([postgresContainerId]);
			const postgresUserArg = quote([postgres.user]);
			const postgresDatabaseArg = quote([postgres.database]);
			const postgresDatabaseIdentifier = quotePostgresIdentifier(
				postgres.database,
			);
			const postgresDatabaseLiteral = quotePostgresLiteral(postgres.database);

			// Drop and recreate database
			emit("Disconnecting all users from database...");
			await execAsync(
				`docker exec ${postgresContainerIdArg} psql -U ${postgresUserArg} postgres -c ${quote([`SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = ${postgresDatabaseLiteral} AND pid <> pg_backend_pid();`])}`,
			);

			emit("Dropping existing database...");
			await execAsync(
				`docker exec ${postgresContainerIdArg} psql -U ${postgresUserArg} postgres -c ${quote([`DROP DATABASE IF EXISTS ${postgresDatabaseIdentifier};`])}`,
			);

			emit("Creating fresh database...");
			await execAsync(
				`docker exec ${postgresContainerIdArg} psql -U ${postgresUserArg} postgres -c ${quote([`CREATE DATABASE ${postgresDatabaseIdentifier};`])}`,
			);

			// Copy the backup file into the container
			emit("Copying backup file into container...");
			await execAsync(
				`docker cp ${quote([join(tempDir, "database.sql")])} ${quote([`${postgresContainerId}:/tmp/database.sql`])}`,
			);

			// Verify file in container
			emit("Verifying file in container...");
			await execAsync(
				`docker exec ${postgresContainerIdArg} ls -l /tmp/database.sql`,
			);

			// Restore from the copied file
			emit("Running database restore...");
			await execAsync(
				`docker exec ${postgresContainerIdArg} pg_restore -v -U ${postgresUserArg} -d ${postgresDatabaseArg} /tmp/database.sql`,
			);

			// Cleanup the temporary file in the container
			emit("Cleaning up container temp file...");
			await execAsync(
				`docker exec ${postgresContainerIdArg} rm /tmp/database.sql`,
			);

			logger.info({ backupFile }, "Web server restore completed");
			emit("Restore completed successfully!");
		} finally {
			// Cleanup
			emit("Cleaning up temporary files...");
			await rm(tempDir, { recursive: true, force: true });
		}
	} catch (error) {
		logger.error(
			{ err: error, backupFile },
			"Web server backup restore failed",
		);
		emit(
			`Error: ${
				error instanceof Error
					? error.message
					: "Error restoring web server backup"
			}`,
		);
		throw error;
	}
};
