import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import {
	applications,
	compose,
	libsql,
	mariadb,
	mongo,
	mysql,
	postgres,
	redis,
	workspaceServiceConnections,
	workspaceServiceLayouts,
} from "@/server/core/db/schema";
import type { findEnvironmentById } from "@/server/core/services/environment";
import { type EnvEntry, upsertEnvironmentVariables } from "@/shared/env-string";
import {
	extractWorkspaceServicesFromEnvironment,
	getWorkspaceServiceKey,
	normalizeWorkspaceConnectionEndpoints,
	resolveWorkspaceNodes,
	type WorkspaceServiceType,
} from "@/shared/workspace-graph";

type Environment = Awaited<ReturnType<typeof findEnvironmentById>>;
type WorkspaceConnection = typeof workspaceServiceConnections.$inferSelect;

export const getWorkspaceServiceSet = (environment: Environment) =>
	new Set(
		extractWorkspaceServicesFromEnvironment(environment).map((service) =>
			getWorkspaceServiceKey(service.type, service.id),
		),
	);

export const assertWorkspaceServiceExists = (
	environment: Environment,
	serviceType: WorkspaceServiceType,
	serviceId: string,
) => {
	const serviceSet = getWorkspaceServiceSet(environment);

	if (!serviceSet.has(getWorkspaceServiceKey(serviceType, serviceId))) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Service is not part of this environment",
		});
	}
};

export const getEnvironmentWorkspace = async (environment: Environment) => {
	const services = extractWorkspaceServicesFromEnvironment(environment);
	const serviceKeys = new Set(
		services.map((service) => getWorkspaceServiceKey(service.type, service.id)),
	);

	const [layouts, rawConnections] = await Promise.all([
		db.query.workspaceServiceLayouts.findMany({
			where: eq(
				workspaceServiceLayouts.environmentId,
				environment.environmentId,
			),
		}),
		db.query.workspaceServiceConnections.findMany({
			where: eq(
				workspaceServiceConnections.environmentId,
				environment.environmentId,
			),
		}),
	]);

	const nodes = resolveWorkspaceNodes(services, layouts);
	const connections = rawConnections.filter(
		(connection) =>
			serviceKeys.has(
				getWorkspaceServiceKey(
					connection.sourceServiceType,
					connection.sourceServiceId,
				),
			) &&
			serviceKeys.has(
				getWorkspaceServiceKey(
					connection.targetServiceType,
					connection.targetServiceId,
				),
			),
	);

	return {
		environment,
		project: environment.project,
		services,
		nodes,
		connections,
	};
};

export const upsertWorkspaceNode = async (input: {
	environmentId: string;
	serviceType: WorkspaceServiceType;
	serviceId: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
}) => {
	const now = new Date().toISOString();

	const result = await db
		.insert(workspaceServiceLayouts)
		.values({
			environmentId: input.environmentId,
			serviceType: input.serviceType,
			serviceId: input.serviceId,
			x: input.x,
			y: input.y,
			width: input.width ?? 280,
			height: input.height ?? 164,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				workspaceServiceLayouts.environmentId,
				workspaceServiceLayouts.serviceType,
				workspaceServiceLayouts.serviceId,
			],
			set: {
				x: input.x,
				y: input.y,
				width: input.width ?? 280,
				height: input.height ?? 164,
				updatedAt: now,
			},
		})
		.returning()
		.then((rows) => rows[0]);

	if (!result) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Unable to update workspace node",
		});
	}

	return result;
};

export const createWorkspaceConnection = async (input: {
	environmentId: string;
	sourceServiceType: WorkspaceServiceType;
	sourceServiceId: string;
	targetServiceType: WorkspaceServiceType;
	targetServiceId: string;
	label?: string | null;
}) => {
	const normalized = normalizeWorkspaceConnectionEndpoints(
		{
			serviceType: input.sourceServiceType,
			serviceId: input.sourceServiceId,
		},
		{
			serviceType: input.targetServiceType,
			serviceId: input.targetServiceId,
		},
	);
	const sourceServiceType = normalized.source.serviceType;
	const sourceServiceId = normalized.source.serviceId;
	const targetServiceType = normalized.target.serviceType;
	const targetServiceId = normalized.target.serviceId;

	if (
		sourceServiceType === targetServiceType &&
		sourceServiceId === targetServiceId
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A service cannot connect to itself",
		});
	}

	const now = new Date().toISOString();

	const result = await db
		.insert(workspaceServiceConnections)
		.values({
			environmentId: input.environmentId,
			sourceServiceType,
			sourceServiceId,
			targetServiceType,
			targetServiceId,
			label: input.label || null,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				workspaceServiceConnections.environmentId,
				workspaceServiceConnections.sourceServiceType,
				workspaceServiceConnections.sourceServiceId,
				workspaceServiceConnections.targetServiceType,
				workspaceServiceConnections.targetServiceId,
			],
			set: {
				label: input.label || null,
				updatedAt: now,
			},
		})
		.returning()
		.then((rows) => rows[0]);

	if (!result) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Unable to create workspace connection",
		});
	}

	return result;
};

export const findWorkspaceConnectionById = async (connectionId: string) => {
	const connection = await db.query.workspaceServiceConnections.findFirst({
		where: eq(workspaceServiceConnections.connectionId, connectionId),
	});

	if (!connection) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Workspace connection not found",
		});
	}

	return connection;
};

export const removeWorkspaceConnection = async (connectionId: string) =>
	db
		.delete(workspaceServiceConnections)
		.where(eq(workspaceServiceConnections.connectionId, connectionId))
		.returning()
		.then((rows) => rows[0]);

const encodeUrlPart = (value: string) => encodeURIComponent(value);

const getConnectionVariableEntriesFromSource = async (
	connection: WorkspaceConnection,
): Promise<EnvEntry[]> => {
	switch (connection.sourceServiceType) {
		case "postgres": {
			const source = await db.query.postgres.findFirst({
				where: eq(postgres.postgresId, connection.sourceServiceId),
				columns: {
					appName: true,
					databaseName: true,
					databaseUser: true,
					databasePassword: true,
				},
			});
			if (!source) return [];

			const user = encodeUrlPart(source.databaseUser);
			const password = encodeUrlPart(source.databasePassword);
			const database = encodeUrlPart(source.databaseName);
			return [
				{
					key: "DATABASE_URL",
					value: `postgresql://${user}:${password}@${source.appName}:5432/${database}`,
				},
				{ key: "POSTGRES_HOST", value: source.appName },
				{ key: "POSTGRES_DB", value: source.databaseName },
				{ key: "POSTGRES_USER", value: source.databaseUser },
				{ key: "POSTGRES_PASSWORD", value: source.databasePassword },
			];
		}
		case "mysql": {
			const source = await db.query.mysql.findFirst({
				where: eq(mysql.mysqlId, connection.sourceServiceId),
				columns: {
					appName: true,
					databaseName: true,
					databaseUser: true,
					databasePassword: true,
				},
			});
			if (!source) return [];

			const user = encodeUrlPart(source.databaseUser);
			const password = encodeUrlPart(source.databasePassword);
			const database = encodeUrlPart(source.databaseName);
			return [
				{
					key: "DATABASE_URL",
					value: `mysql://${user}:${password}@${source.appName}:3306/${database}`,
				},
				{ key: "MYSQL_HOST", value: source.appName },
				{ key: "MYSQL_DATABASE", value: source.databaseName },
				{ key: "MYSQL_USER", value: source.databaseUser },
				{ key: "MYSQL_PASSWORD", value: source.databasePassword },
			];
		}
		case "mariadb": {
			const source = await db.query.mariadb.findFirst({
				where: eq(mariadb.mariadbId, connection.sourceServiceId),
				columns: {
					appName: true,
					databaseName: true,
					databaseUser: true,
					databasePassword: true,
				},
			});
			if (!source) return [];

			const user = encodeUrlPart(source.databaseUser);
			const password = encodeUrlPart(source.databasePassword);
			const database = encodeUrlPart(source.databaseName);
			return [
				{
					key: "DATABASE_URL",
					value: `mariadb://${user}:${password}@${source.appName}:3306/${database}`,
				},
				{ key: "MARIADB_HOST", value: source.appName },
				{ key: "MARIADB_DATABASE", value: source.databaseName },
				{ key: "MARIADB_USER", value: source.databaseUser },
				{ key: "MARIADB_PASSWORD", value: source.databasePassword },
			];
		}
		case "mongo": {
			const source = await db.query.mongo.findFirst({
				where: eq(mongo.mongoId, connection.sourceServiceId),
				columns: {
					appName: true,
					databaseUser: true,
					databasePassword: true,
				},
			});
			if (!source) return [];

			const user = encodeUrlPart(source.databaseUser);
			const password = encodeUrlPart(source.databasePassword);
			return [
				{
					key: "MONGO_URL",
					value: `mongodb://${user}:${password}@${source.appName}:27017/?authSource=admin`,
				},
				{ key: "MONGO_HOST", value: source.appName },
				{ key: "MONGO_USER", value: source.databaseUser },
				{ key: "MONGO_PASSWORD", value: source.databasePassword },
			];
		}
		case "redis": {
			const source = await db.query.redis.findFirst({
				where: eq(redis.redisId, connection.sourceServiceId),
				columns: {
					appName: true,
					databasePassword: true,
				},
			});
			if (!source) return [];

			const password = encodeUrlPart(source.databasePassword);
			return [
				{
					key: "REDIS_URL",
					value: `redis://:${password}@${source.appName}:6379`,
				},
				{ key: "REDIS_HOST", value: source.appName },
				{ key: "REDIS_PASSWORD", value: source.databasePassword },
			];
		}
		case "libsql": {
			const source = await db.query.libsql.findFirst({
				where: eq(libsql.libsqlId, connection.sourceServiceId),
				columns: {
					appName: true,
					databasePassword: true,
				},
			});
			if (!source) return [];

			return [
				{ key: "LIBSQL_URL", value: `http://${source.appName}:8080` },
				{ key: "LIBSQL_AUTH_TOKEN", value: source.databasePassword },
			];
		}
		default:
			return [];
	}
};

const readTargetEnv = async (connection: WorkspaceConnection) => {
	return readWorkspaceServiceEnv({
		serviceType: connection.targetServiceType,
		serviceId: connection.targetServiceId,
	});
};

const updateTargetEnv = async (
	connection: WorkspaceConnection,
	env: string,
) => {
	return updateWorkspaceServiceEnv({
		serviceType: connection.targetServiceType,
		serviceId: connection.targetServiceId,
		env,
	});
};

export const readWorkspaceServiceEnv = async (input: {
	serviceType: WorkspaceServiceType;
	serviceId: string;
}) => {
	switch (input.serviceType) {
		case "application":
			return db.query.applications.findFirst({
				where: eq(applications.applicationId, input.serviceId),
				columns: { env: true },
			});
		case "compose":
			return db.query.compose.findFirst({
				where: eq(compose.composeId, input.serviceId),
				columns: { env: true },
			});
		case "postgres":
			return db.query.postgres.findFirst({
				where: eq(postgres.postgresId, input.serviceId),
				columns: { env: true },
			});
		case "mysql":
			return db.query.mysql.findFirst({
				where: eq(mysql.mysqlId, input.serviceId),
				columns: { env: true },
			});
		case "mariadb":
			return db.query.mariadb.findFirst({
				where: eq(mariadb.mariadbId, input.serviceId),
				columns: { env: true },
			});
		case "mongo":
			return db.query.mongo.findFirst({
				where: eq(mongo.mongoId, input.serviceId),
				columns: { env: true },
			});
		case "redis":
			return db.query.redis.findFirst({
				where: eq(redis.redisId, input.serviceId),
				columns: { env: true },
			});
		case "libsql":
			return db.query.libsql.findFirst({
				where: eq(libsql.libsqlId, input.serviceId),
				columns: { env: true },
			});
	}
};

export const updateWorkspaceServiceEnv = async (input: {
	serviceType: WorkspaceServiceType;
	serviceId: string;
	env: string;
}) => {
	switch (input.serviceType) {
		case "application":
			return db
				.update(applications)
				.set({ env: input.env })
				.where(eq(applications.applicationId, input.serviceId))
				.returning();
		case "compose":
			return db
				.update(compose)
				.set({ env: input.env })
				.where(eq(compose.composeId, input.serviceId))
				.returning();
		case "postgres":
			return db
				.update(postgres)
				.set({ env: input.env })
				.where(eq(postgres.postgresId, input.serviceId))
				.returning();
		case "mysql":
			return db
				.update(mysql)
				.set({ env: input.env })
				.where(eq(mysql.mysqlId, input.serviceId))
				.returning();
		case "mariadb":
			return db
				.update(mariadb)
				.set({ env: input.env })
				.where(eq(mariadb.mariadbId, input.serviceId))
				.returning();
		case "mongo":
			return db
				.update(mongo)
				.set({ env: input.env })
				.where(eq(mongo.mongoId, input.serviceId))
				.returning();
		case "redis":
			return db
				.update(redis)
				.set({ env: input.env })
				.where(eq(redis.redisId, input.serviceId))
				.returning();
		case "libsql":
			return db
				.update(libsql)
				.set({ env: input.env })
				.where(eq(libsql.libsqlId, input.serviceId))
				.returning();
	}
};

export const getWorkspaceConnectionVariableEntries = async (
	connection: WorkspaceConnection,
) => getConnectionVariableEntriesFromSource(connection);

export const applyWorkspaceConnectionVariables = async (
	connection: WorkspaceConnection,
) => {
	const entries = await getConnectionVariableEntriesFromSource(connection);

	if (entries.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This connection does not expose generated variables yet",
		});
	}

	const target = await readTargetEnv(connection);
	if (!target) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Target service not found",
		});
	}

	const env = upsertEnvironmentVariables(target.env, entries);
	await updateTargetEnv(connection, env);

	return {
		env,
		entries: entries.map(({ key }) => ({ key })),
	};
};

export const deleteWorkspaceNodesForMissingServices = async (
	environment: Environment,
) => {
	const serviceKeys = getWorkspaceServiceSet(environment);
	const layouts = await db.query.workspaceServiceLayouts.findMany({
		where: eq(workspaceServiceLayouts.environmentId, environment.environmentId),
	});

	const staleLayoutIds = layouts
		.filter(
			(layout) =>
				!serviceKeys.has(
					getWorkspaceServiceKey(layout.serviceType, layout.serviceId),
				),
		)
		.map((layout) => layout.layoutId);

	if (staleLayoutIds.length === 0) return [];

	const deleted = [];
	for (const layoutId of staleLayoutIds) {
		const row = await db
			.delete(workspaceServiceLayouts)
			.where(
				and(
					eq(workspaceServiceLayouts.environmentId, environment.environmentId),
					eq(workspaceServiceLayouts.layoutId, layoutId),
				),
			)
			.returning()
			.then((rows) => rows[0]);
		if (row) deleted.push(row);
	}

	return deleted;
};
