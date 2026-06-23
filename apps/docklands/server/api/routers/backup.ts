import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateBackup,
	apiFindOneBackup,
	apiRemoveBackup,
	apiRestoreBackup,
	apiUpdateBackup,
} from "@/server/core/db/schema";
import {
	createBackup,
	findBackupById,
	removeBackupById,
	updateBackupById,
} from "@/server/core/services/backup";
import { findComposeById } from "@/server/core/services/compose";
import { findDestinationById } from "@/server/core/services/destination";
import {
	findLibsqlByBackupId,
	findLibsqlById,
} from "@/server/core/services/libsql";
import {
	findMariadbByBackupId,
	findMariadbById,
} from "@/server/core/services/mariadb";
import {
	findComposeByBackupId,
	findMongoByBackupId,
	findMongoById,
} from "@/server/core/services/mongo";
import {
	findMySqlByBackupId,
	findMySqlById,
} from "@/server/core/services/mysql";
import { checkServicePermissionAndAccess } from "@/server/core/services/permission";
import {
	findPostgresByBackupId,
	findPostgresById,
} from "@/server/core/services/postgres";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { runComposeBackup } from "@/server/core/utils/backups/compose";
import { keepLatestNBackups } from "@/server/core/utils/backups/index";
import { runLibsqlBackup } from "@/server/core/utils/backups/libsql";
import { runMariadbBackup } from "@/server/core/utils/backups/mariadb";
import { runMongoBackup } from "@/server/core/utils/backups/mongo";
import { runMySqlBackup } from "@/server/core/utils/backups/mysql";
import { runPostgresBackup } from "@/server/core/utils/backups/postgres";
import {
	getS3Credentials,
	normalizeS3Path,
	removeScheduleBackup,
	scheduleBackup,
} from "@/server/core/utils/backups/utils";
import { runWebServerBackup } from "@/server/core/utils/backups/web-server";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import {
	restoreComposeBackup,
	restoreLibsqlBackup,
	restoreMariadbBackup,
	restoreMongoBackup,
	restoreMySqlBackup,
	restorePostgresBackup,
	restoreWebServerBackup,
} from "@/server/core/utils/restore";

interface RcloneFile {
	Path: string;
	Name: string;
	Size: number;
	IsDir: boolean;
	Tier?: string;
	Hashes?: {
		MD5?: string;
		SHA1?: string;
	};
}

export const backupRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const serviceId =
					input.postgresId ||
					input.mysqlId ||
					input.mariadbId ||
					input.mongoId ||
					input.libsqlId ||
					input.composeId;
				if (serviceId) {
					await checkServicePermissionAndAccess(ctx, serviceId, {
						backup: ["create"],
					});
				}

				const newBackup = await createBackup(input);
				const backup = await findBackupById(newBackup.backupId);

				if (backup.enabled) {
					scheduleBackup(backup);
				}
				await audit(ctx, {
					action: "create",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
			} catch (error) {
				console.error(error);
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error creating the Backup",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOneBackup)
		.query(async ({ input, ctx }) => {
			const backup = await findBackupById(input.backupId);

			const serviceId =
				backup.postgresId ||
				backup.mysqlId ||
				backup.mariadbId ||
				backup.mongoId ||
				backup.libsqlId ||
				backup.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					backup: ["read"],
				});
			}

			return backup;
		}),
	update: protectedProcedure
		.input(apiUpdateBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const existing = await findBackupById(input.backupId);
				const serviceId =
					existing.postgresId ||
					existing.mysqlId ||
					existing.mariadbId ||
					existing.mongoId ||
					existing.libsqlId ||
					existing.composeId;
				if (serviceId) {
					await checkServicePermissionAndAccess(ctx, serviceId, {
						backup: ["update"],
					});
				}

				await updateBackupById(input.backupId, input);
				const backup = await findBackupById(input.backupId);

				if (backup.enabled) {
					removeScheduleBackup(input.backupId);
					scheduleBackup(backup);
				} else {
					removeScheduleBackup(input.backupId);
				}
				await audit(ctx, {
					action: "update",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error updating this Backup";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),
	remove: protectedProcedure
		.input(apiRemoveBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				const serviceId =
					backup.postgresId ||
					backup.mysqlId ||
					backup.mariadbId ||
					backup.mongoId ||
					backup.libsqlId ||
					backup.composeId;
				if (serviceId) {
					await checkServicePermissionAndAccess(ctx, serviceId, {
						backup: ["delete"],
					});
				}

				const value = await removeBackupById(input.backupId);
				removeScheduleBackup(input.backupId);
				await audit(ctx, {
					action: "delete",
					resourceType: "backup",
					resourceId: input.backupId,
				});
				return value;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Error deleting this Backup";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),
	manualBackupPostgres: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (backup.postgresId) {
					await checkServicePermissionAndAccess(ctx, backup.postgresId, {
						backup: ["create"],
					});
				}
				const postgres = await findPostgresByBackupId(backup.backupId);
				await runPostgresBackup(postgres, backup);
				await keepLatestNBackups(backup, postgres?.runtimeWorkerId);
				await audit(ctx, {
					action: "run",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
				return true;
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Error running manual Postgres backup ";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),

	manualBackupMySql: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (backup.mysqlId) {
					await checkServicePermissionAndAccess(ctx, backup.mysqlId, {
						backup: ["create"],
					});
				}
				const mysql = await findMySqlByBackupId(backup.backupId);
				await runMySqlBackup(mysql, backup);
				await keepLatestNBackups(backup, mysql?.runtimeWorkerId);
				await audit(ctx, {
					action: "run",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error running manual MySQL backup ",
					cause: error,
				});
			}
		}),
	manualBackupMariadb: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (backup.mariadbId) {
					await checkServicePermissionAndAccess(ctx, backup.mariadbId, {
						backup: ["create"],
					});
				}
				const mariadb = await findMariadbByBackupId(backup.backupId);
				await runMariadbBackup(mariadb, backup);
				await keepLatestNBackups(backup, mariadb?.runtimeWorkerId);
				await audit(ctx, {
					action: "run",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error running manual Mariadb backup ",
					cause: error,
				});
			}
		}),
	manualBackupCompose: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (backup.composeId) {
					await checkServicePermissionAndAccess(ctx, backup.composeId, {
						backup: ["create"],
					});
				}
				const compose = await findComposeByBackupId(backup.backupId);
				await runComposeBackup(compose, backup);
				await keepLatestNBackups(backup, compose?.runtimeWorkerId);
				await audit(ctx, {
					action: "run",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error running manual Compose backup ",
					cause: error,
				});
			}
		}),
	manualBackupMongo: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (backup.mongoId) {
					await checkServicePermissionAndAccess(ctx, backup.mongoId, {
						backup: ["create"],
					});
				}
				const mongo = await findMongoByBackupId(backup.backupId);
				await runMongoBackup(mongo, backup);
				await keepLatestNBackups(backup, mongo?.runtimeWorkerId);
				await audit(ctx, {
					action: "run",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error running manual Mongo backup ",
					cause: error,
				});
			}
		}),
	manualBackupLibsql: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (backup.libsqlId) {
					await checkServicePermissionAndAccess(ctx, backup.libsqlId, {
						backup: ["create"],
					});
				}
				const libsql = await findLibsqlByBackupId(backup.backupId);
				await runLibsqlBackup(libsql, backup);
				await keepLatestNBackups(backup, libsql?.runtimeWorkerId);
				await audit(ctx, {
					action: "run",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error running manual Libsql backup ",
					cause: error,
				});
			}
		}),
	manualBackupWebServer: withPermission("backup", "create")
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			const backup = await findBackupById(input.backupId);
			await runWebServerBackup(backup);
			await keepLatestNBackups(backup);
			await audit(ctx, {
				action: "run",
				resourceType: "backup",
				resourceId: backup.backupId,
			});
			return true;
		}),
	listBackupFiles: withPermission("backup", "read")
		.input(
			z.object({
				destinationId: z.string(),
				search: z.string(),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			try {
				const destination = await findDestinationById(input.destinationId);
				if (destination.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You don't have access to this destination.",
					});
				}
				if (input.runtimeWorkerId) {
					const targetServer = await findRuntimeWorkerById(
						input.runtimeWorkerId,
					);
					if (
						targetServer.organizationId !== ctx.session.activeOrganizationId
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this runtime worker.",
						});
					}
				}
				const rcloneFlags = getS3Credentials(destination);
				const bucketPath = `:s3:${destination.bucket}`;

				const lastSlashIndex = input.search.lastIndexOf("/");
				const baseDir =
					lastSlashIndex !== -1
						? normalizeS3Path(input.search.slice(0, lastSlashIndex + 1))
						: "";
				const searchTerm =
					lastSlashIndex !== -1
						? input.search.slice(lastSlashIndex + 1)
						: input.search;

				const searchPath = baseDir ? `${bucketPath}/${baseDir}` : bucketPath;
				const listCommand = `rclone lsjson ${rcloneFlags.join(" ")} "${searchPath}" --no-mimetype --no-modtime 2>/dev/null`;

				let stdout = "";

				if (input.runtimeWorkerId) {
					const result = await execAsyncRemote(
						input.runtimeWorkerId,
						listCommand,
					);
					stdout = result.stdout;
				} else {
					const result = await execAsync(listCommand);
					stdout = result.stdout;
				}

				let files: RcloneFile[] = [];
				try {
					files = JSON.parse(stdout) as RcloneFile[];
				} catch (error) {
					console.error("Error parsing JSON response:", error);
					console.error("Raw stdout:", stdout);
					throw new Error("Failed to parse backup files list");
				}

				// Limit to first 100 files

				const results = baseDir
					? files.map((file) => ({
							...file,
							Path: `${baseDir}${file.Path}`,
						}))
					: files;

				if (searchTerm) {
					return results
						.filter((file) =>
							file.Path.toLowerCase().includes(searchTerm.toLowerCase()),
						)
						.slice(0, 100);
				}

				return results.slice(0, 100);
			} catch (error) {
				console.error("Error in listBackupFiles:", error);
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error listing backup files",
					cause: error,
				});
			}
		}),

	restoreBackupWithLogs: protectedProcedure
		.meta({
			openapi: {
				enabled: false,
				path: "/restore-backup-with-logs",
				method: "POST",
				override: true,
			},
		})
		.input(apiRestoreBackup)
		.subscription(async function* ({ input, ctx, signal }) {
			if (input.databaseId) {
				await checkServicePermissionAndAccess(ctx, input.databaseId, {
					backup: ["restore"],
				});
			}
			const destination = await findDestinationById(input.destinationId);
			const queue: string[] = [];
			let done = false;
			const onLog = (log: string) => queue.push(log);
			const runRestore = async () => {
				if (input.backupType === "database") {
					if (input.databaseType === "postgres") {
						const postgres = await findPostgresById(input.databaseId);
						await restorePostgresBackup(postgres, destination, input, onLog);
					} else if (input.databaseType === "mysql") {
						const mysql = await findMySqlById(input.databaseId);
						await restoreMySqlBackup(mysql, destination, input, onLog);
					} else if (input.databaseType === "mariadb") {
						const mariadb = await findMariadbById(input.databaseId);
						await restoreMariadbBackup(mariadb, destination, input, onLog);
					} else if (input.databaseType === "mongo") {
						const mongo = await findMongoById(input.databaseId);
						await restoreMongoBackup(mongo, destination, input, onLog);
					} else if (input.databaseType === "libsql") {
						const libsql = await findLibsqlById(input.databaseId);
						await restoreLibsqlBackup(libsql, destination, input, onLog);
					} else if (input.databaseType === "web-server") {
						await restoreWebServerBackup(destination, input.backupFile, onLog);
					}
				} else if (input.backupType === "compose") {
					const compose = await findComposeById(input.databaseId);
					await restoreComposeBackup(compose, destination, input, onLog);
				}
			};
			runRestore()
				.catch((error) => {
					onLog(
						`Error: ${error instanceof Error ? error.message : String(error)}`,
					);
				})
				.finally(() => {
					done = true;
				});
			while (!done || queue.length > 0) {
				if (queue.length > 0) {
					yield queue.shift()!;
				} else {
					await new Promise((r) => setTimeout(r, 50));
				}

				if (signal?.aborted) {
					return;
				}
			}
		}),
});
