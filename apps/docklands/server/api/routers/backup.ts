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
import {
	findComposeByBackupId,
	findComposeById,
} from "@/server/core/services/compose";
import { findDatabaseById } from "@/server/core/services/database";
import { findDestinationById } from "@/server/core/services/destination";
import { checkServicePermissionAndAccess } from "@/server/core/services/permission";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { runComposeBackup } from "@/server/core/utils/backups/compose";
import { runDatabaseBackup } from "@/server/core/utils/backups/database";
import { keepLatestNBackups } from "@/server/core/utils/backups/index";
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
	restoreDatabaseBackup,
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
				const serviceId = input.databaseId || input.composeId;
				if (serviceId) {
					await checkServicePermissionAndAccess(ctx, serviceId, {
						backup: ["create"],
					});
				}

				// For managed-database backups, derive the databaseType from the
				// database's engine so the stored type always matches the engine.
				let createInput = input;
				if (input.backupType === "database" && input.databaseId) {
					const database = await findDatabaseById(input.databaseId);
					if (database.engine === "redis") {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Redis databases do not support backups",
						});
					}
					createInput = { ...input, databaseType: database.engine };
				}

				const newBackup = await createBackup(createInput);
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

			const serviceId = backup.databaseId || backup.composeId;
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
				const serviceId = existing.databaseId || existing.composeId;
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
				const serviceId = backup.databaseId || backup.composeId;
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
	manualBackupDatabase: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (!backup.databaseId) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Backup is not associated with a database",
					});
				}
				await checkServicePermissionAndAccess(ctx, backup.databaseId, {
					backup: ["create"],
				});
				const database = await findDatabaseById(backup.databaseId);
				await runDatabaseBackup(database, backup);
				await keepLatestNBackups(backup, database.runtimeWorkerId);
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
						: "Error running manual database backup ";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
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
					if (input.databaseType === "web-server") {
						await restoreWebServerBackup(destination, input.backupFile, onLog);
					} else {
						const database = await findDatabaseById(input.databaseId);
						await restoreDatabaseBackup(database, destination, input, onLog);
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
