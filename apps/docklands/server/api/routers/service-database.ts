import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	findBackupById,
	findBackupsByServiceDatabaseId,
} from "@/server/core/services/backup";
import { checkServiceAccess } from "@/server/core/services/permission";
import {
	findServiceDatabaseById,
	findServiceDatabasesByComposeId,
	getServiceDatabaseConnectionVars,
	serviceDatabaseSupportsBackup,
} from "@/server/core/services/service-database";
import { keepLatestNBackups } from "@/server/core/utils/backups/index";
import { runServiceDatabaseBackup } from "@/server/core/utils/backups/service-database";

export const serviceDatabaseRouter = createTRPCRouter({
	/** Databases detected inside a compose stack (the template bridge). */
	byCompose: protectedProcedure
		.input(z.object({ composeId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.composeId, "read");
			const databases = await findServiceDatabasesByComposeId(input.composeId);
			return databases.map((database) => ({
				serviceDatabaseId: database.serviceDatabaseId,
				serviceName: database.serviceName,
				engine: database.engine,
				image: database.image,
				supportsBackup: serviceDatabaseSupportsBackup(database),
			}));
		}),
	/** Read-only connection variables for a compose-embedded database. */
	connectionInfo: protectedProcedure
		.input(z.object({ serviceDatabaseId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			const database = await findServiceDatabaseById(input.serviceDatabaseId);
			await checkServiceAccess(ctx, database.composeId, "read");
			return {
				serviceName: database.serviceName,
				engine: database.engine,
				supportsBackup: serviceDatabaseSupportsBackup(database),
				connectionVariables: getServiceDatabaseConnectionVars(database),
			};
		}),
	/** Configured backups for a compose-embedded database. */
	backups: protectedProcedure
		.input(z.object({ serviceDatabaseId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			const database = await findServiceDatabaseById(input.serviceDatabaseId);
			await checkServiceAccess(ctx, database.composeId, "read");
			return findBackupsByServiceDatabaseId(input.serviceDatabaseId);
		}),
	/** Run a configured service-database backup immediately. */
	manualBackup: protectedProcedure
		.input(z.object({ backupId: z.string().min(1) }))
		.mutation(async ({ input, ctx }) => {
			try {
				const backup = await findBackupById(input.backupId);
				if (!backup.serviceDatabaseId) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Backup is not associated with a service database",
					});
				}
				const database = await findServiceDatabaseById(
					backup.serviceDatabaseId,
				);
				await checkServiceAccess(ctx, database.composeId, "create");
				await runServiceDatabaseBackup(database, backup);
				await keepLatestNBackups(backup, database.compose.runtimeWorkerId);
				await audit(ctx, {
					action: "run",
					resourceType: "backup",
					resourceId: backup.backupId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error running manual service database backup",
					cause: error,
				});
			}
		}),
});
