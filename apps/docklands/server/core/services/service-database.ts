import { TRPCError } from "@trpc/server";
import { eq, getTableColumns } from "drizzle-orm";
import {
	databaseConnectionVars,
	databaseEngineSupportsBackup,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import { db } from "@/server/core/db";
import { backups, serviceDatabase } from "@/server/core/db/schema";

export type ServiceDatabase = typeof serviceDatabase.$inferSelect;

/** A compose-embedded database with its owning compose + environment loaded. */
export const findServiceDatabaseById = async (serviceDatabaseId: string) => {
	const result = await db.query.serviceDatabase.findFirst({
		where: eq(serviceDatabase.serviceDatabaseId, serviceDatabaseId),
		with: {
			compose: {
				with: {
					environment: {
						with: { workspace: true },
					},
				},
			},
		},
	});
	if (!result) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Service database not found",
		});
	}
	return result;
};

export const findServiceDatabasesByComposeId = async (composeId: string) =>
	db.query.serviceDatabase.findMany({
		where: eq(serviceDatabase.composeId, composeId),
	});

export const findServiceDatabaseByBackupId = async (backupId: string) => {
	const result = await db
		.select({ ...getTableColumns(serviceDatabase) })
		.from(serviceDatabase)
		.innerJoin(
			backups,
			eq(serviceDatabase.serviceDatabaseId, backups.serviceDatabaseId),
		)
		.where(eq(backups.backupId, backupId))
		.limit(1);
	if (!result?.[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Service database not found",
		});
	}
	return result[0];
};

/**
 * Connection variables for a compose-embedded database. Other services in the
 * same compose reach it by its service name, so that is the host.
 */
export const getServiceDatabaseConnectionVars = (database: ServiceDatabase) =>
	databaseConnectionVars(database.engine, {
		appName: database.serviceName,
		config: parseDatabaseConfig(database.engine, database.config) as never,
	});

export const serviceDatabaseSupportsBackup = (database: ServiceDatabase) =>
	databaseEngineSupportsBackup(database.engine);
