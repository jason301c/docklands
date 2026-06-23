import { TRPCError } from "@trpc/server";
import { eq, getTableColumns } from "drizzle-orm";
import type { z } from "zod";
import {
	type DatabaseEngineKey,
	databaseMountPath,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import { db } from "@/server/core/db";
import {
	type apiCreateDatabase,
	backups,
	buildAppName,
	database,
} from "@/server/core/db/schema";
import { generatePassword } from "@/server/core/templates";
import { buildDatabase } from "@/server/core/utils/databases/build";
import { pullImage } from "@/server/core/utils/docker/utils";
import { execAsyncRemote } from "@/server/core/utils/process/execAsync";
import { validUniqueServerAppName } from "./workspace";

export type Database = typeof database.$inferSelect;

/** Mount path for a managed database's data volume, derived from the engine. */
export const getDatabaseMountPath = (
	engine: DatabaseEngineKey,
	dockerImage: string,
): string => databaseMountPath(engine, dockerImage);

export const createDatabase = async (
	input: z.infer<typeof apiCreateDatabase>,
) => {
	const appName = buildAppName(input.engine, input.appName);

	const valid = await validUniqueServerAppName(appName);
	if (!valid) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Service with this 'AppName' already exists",
		});
	}

	// Validate (and normalize defaults for) the engine-specific config.
	const config = parseDatabaseConfig(input.engine, input.config) as Record<
		string,
		unknown
	>;
	// Preserve the legacy per-engine behavior of generating a password when one
	// isn't supplied (applies to both the user and root passwords).
	for (const key of ["databasePassword", "databaseRootPassword"]) {
		if (key in config && !config[key]) config[key] = generatePassword();
	}

	const newDatabase = await db
		.insert(database)
		.values({
			...input,
			config: config as (typeof database.$inferInsert)["config"],
			appName,
		})
		.returning()
		.then((value) => value[0]);

	if (!newDatabase) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error input: Inserting database",
		});
	}

	return newDatabase;
};

export const findDatabaseById = async (databaseId: string) => {
	const result = await db.query.database.findFirst({
		where: eq(database.databaseId, databaseId),
		with: {
			environment: {
				with: {
					workspace: true,
				},
			},
			mounts: true,
			runtimeWorker: true,
			backups: {
				with: {
					destination: {
						columns: {
							accessKey: false,
							secretAccessKey: false,
						},
					},
					deployments: true,
				},
			},
		},
	});
	if (!result) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Database not found",
		});
	}
	return result;
};

export const findDatabaseByBackupId = async (backupId: string) => {
	const result = await db
		.select({
			...getTableColumns(database),
		})
		.from(database)
		.innerJoin(backups, eq(database.databaseId, backups.databaseId))
		.where(eq(backups.backupId, backupId))
		.limit(1);

	if (!result?.[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Database not found",
		});
	}
	return result[0];
};

export const updateDatabaseById = async (
	databaseId: string,
	databaseData: Partial<Database>,
) => {
	const { appName, ...rest } = databaseData;
	const result = await db
		.update(database)
		.set({
			...rest,
		})
		.where(eq(database.databaseId, databaseId))
		.returning();

	return result[0];
};

export const removeDatabaseById = async (databaseId: string) => {
	const result = await db
		.delete(database)
		.where(eq(database.databaseId, databaseId))
		.returning();

	return result[0];
};

export const deployDatabase = async (
	databaseId: string,
	onData?: (data: unknown) => void,
) => {
	const service = await findDatabaseById(databaseId);
	try {
		await updateDatabaseById(databaseId, {
			applicationStatus: "running",
		});

		onData?.(`Starting ${service.engine} deployment...`);

		if (service.runtimeWorkerId) {
			await execAsyncRemote(
				service.runtimeWorkerId,
				`docker pull ${service.dockerImage}`,
				onData,
			);
		} else {
			await pullImage(service.dockerImage, onData);
		}

		await buildDatabase(service);

		await updateDatabaseById(databaseId, {
			applicationStatus: "done",
		});

		onData?.("Deployment completed successfully!");
	} catch (error) {
		onData?.(`Error: ${error}`);
		await updateDatabaseById(databaseId, {
			applicationStatus: "error",
		});
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Error on deploy database${error}`,
		});
	}
	return service;
};
