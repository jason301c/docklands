import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import {
	databaseConnectionVars,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import { db } from "@/server/core/db";
import {
	applications,
	compose,
	database,
	workspaceServiceConnections,
	workspaceServiceLayouts,
} from "@/server/core/db/schema";
import { logger } from "@/server/core/lib/logger";
import type { findEnvironmentById } from "@/server/core/services/environment";
import {
	type EnvEntry,
	removeEnvironmentVariables,
	upsertEnvironmentVariables,
} from "@/shared/env-string";
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

	// Prune layout rows for services that no longer exist before reading the
	// canvas, so orphaned `workspace_service_layout` rows get cleaned on load
	// (W4). Best-effort: a cleanup failure must never break the canvas load.
	try {
		await deleteWorkspaceNodesForMissingServices(environment);
	} catch (error) {
		logger.warn(
			{ environmentId: environment.environmentId, error },
			"Failed to prune orphaned workspace layout rows on canvas load",
		);
	}

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
		workspace: environment.workspace,
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

export const removeWorkspaceConnection = async (connectionId: string) => {
	const connection = await db.query.workspaceServiceConnections.findFirst({
		where: eq(workspaceServiceConnections.connectionId, connectionId),
	});

	const removed = await db
		.delete(workspaceServiceConnections)
		.where(eq(workspaceServiceConnections.connectionId, connectionId))
		.returning()
		.then((rows) => rows[0]);

	// Binding model: disconnecting retracts this connection's projected keys from
	// the target, then re-applies the remaining inbound connections so any key
	// still provided by another source is restored. (Previously the link row was
	// deleted but the written keys lingered as stale credentials — W2.)
	if (connection) {
		try {
			const entries = await getConnectionVariableEntriesFromSource(connection);
			if (entries.length > 0) {
				const target = await readTargetEnv(connection);
				if (target) {
					const pruned = removeEnvironmentVariables(
						target.env,
						entries.map((entry) => entry.key),
					);
					await updateTargetEnv(connection, pruned);
				}
			}
			await syncWorkspaceConnectionVariablesForService({
				environmentId: connection.environmentId,
				serviceType: connection.targetServiceType,
				serviceId: connection.targetServiceId,
			});
		} catch (error) {
			logger.warn(
				{ connectionId, error },
				"Failed to retract connection variables on disconnect",
			);
		}
	}

	return removed;
};

type DatabaseSource = Pick<
	typeof database.$inferSelect,
	"appName" | "engine" | "config"
>;

/**
 * Batch-load the database source rows for a set of connections in a single
 * `inArray` query, keyed by databaseId. Only database-engine sources are looked
 * up; application/compose sources have nothing to project, so they're skipped.
 * This replaces a per-connection `findFirst` (N+1) with one round-trip — the
 * per-connection projection in `getConnectionVariableEntriesFromSource` is
 * unchanged, it just reads from this map.
 */
const loadDatabaseSources = async (
	connections: WorkspaceConnection[],
): Promise<Map<string, DatabaseSource>> => {
	const sourceIds = Array.from(
		new Set(
			connections
				.filter(
					(connection) =>
						connection.sourceServiceType !== "application" &&
						connection.sourceServiceType !== "compose",
				)
				.map((connection) => connection.sourceServiceId),
		),
	);

	if (sourceIds.length === 0) {
		return new Map();
	}

	const rows = await db.query.database.findMany({
		where: inArray(database.databaseId, sourceIds),
		columns: { databaseId: true, appName: true, engine: true, config: true },
	});

	return new Map(rows.map((row) => [row.databaseId, row]));
};

const getConnectionVariableEntriesFromSource = async (
	connection: WorkspaceConnection,
	prefetchedSources?: Map<string, DatabaseSource>,
): Promise<EnvEntry[]> => {
	// Only managed-database engines expose generated connection variables.
	// Application/compose sources have nothing to project.
	if (
		connection.sourceServiceType === "application" ||
		connection.sourceServiceType === "compose"
	) {
		return [];
	}

	const source = prefetchedSources
		? prefetchedSources.get(connection.sourceServiceId)
		: await db.query.database.findFirst({
				where: eq(database.databaseId, connection.sourceServiceId),
				columns: { appName: true, engine: true, config: true },
			});
	if (!source) return [];

	return databaseConnectionVars(source.engine, {
		appName: source.appName,
		config: parseDatabaseConfig(source.engine, source.config),
	});
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
		// Every managed-database engine resolves to the unified `database` table.
		default:
			return db.query.database.findFirst({
				where: eq(database.databaseId, input.serviceId),
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
		// Every managed-database engine resolves to the unified `database` table.
		default:
			return db
				.update(database)
				.set({ env: input.env })
				.where(eq(database.databaseId, input.serviceId))
				.returning();
	}
};

export const getWorkspaceConnectionVariableEntries = async (
	connection: WorkspaceConnection,
	prefetchedSources?: Map<string, DatabaseSource>,
) => getConnectionVariableEntriesFromSource(connection, prefetchedSources);

export const applyWorkspaceConnectionVariables = async (
	connection: WorkspaceConnection,
	prefetchedSources?: Map<string, DatabaseSource>,
) => {
	const entries = await getConnectionVariableEntriesFromSource(
		connection,
		prefetchedSources,
	);

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

export const syncWorkspaceConnectionVariablesForService = async (input: {
	environmentId: string;
	serviceType: WorkspaceServiceType;
	serviceId: string;
}) => {
	const connections = await db.query.workspaceServiceConnections.findMany({
		where: and(
			eq(workspaceServiceConnections.environmentId, input.environmentId),
			eq(workspaceServiceConnections.targetServiceType, input.serviceType),
			eq(workspaceServiceConnections.targetServiceId, input.serviceId),
		),
	});

	// Batch the source lookups up front (single inArray query) instead of a
	// `findFirst` per connection; the per-connection logic below is unchanged.
	const prefetchedSources = await loadDatabaseSources(connections);

	const applied: { connectionId: string; keys: string[] }[] = [];

	for (const connection of connections) {
		const entries = await getWorkspaceConnectionVariableEntries(
			connection,
			prefetchedSources,
		);
		if (entries.length === 0) continue;

		const result = await applyWorkspaceConnectionVariables(
			connection,
			prefetchedSources,
		);
		applied.push({
			connectionId: connection.connectionId,
			keys: result.entries.map(({ key }) => key),
		});
	}

	return {
		connectionsScanned: connections.length,
		connectionsApplied: applied.length,
		variablesApplied: applied.reduce(
			(total, connection) => total + connection.keys.length,
			0,
		),
		entries: applied.flatMap((connection) =>
			connection.keys.map((key) => ({
				connectionId: connection.connectionId,
				key,
			})),
		),
	};
};

/**
 * The connection-variable *binding*: just before a consumer service deploys,
 * re-resolve and re-apply its inbound connection variables from the source's
 * *current* config, and return the refreshed env string for the caller to use.
 *
 * This is what makes connection variables a binding rather than a one-time
 * snapshot — a source credential rotation is reflected on the consumer's next
 * deploy with no manual "apply" (D2/W2/W5). Best-effort: a sync failure never
 * blocks the deploy; the caller falls back to the existing env.
 */
export const refreshConnectionVariablesForDeploy = async (input: {
	environmentId: string;
	serviceType: WorkspaceServiceType;
	serviceId: string;
}): Promise<string | null> => {
	try {
		await syncWorkspaceConnectionVariablesForService(input);
	} catch (error) {
		logger.warn(
			{ ...input, error },
			"Failed to refresh connection variables at deploy",
		);
	}
	const target = await readWorkspaceServiceEnv({
		serviceType: input.serviceType,
		serviceId: input.serviceId,
	});
	return target?.env ?? null;
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

	// Delete every stale layout row in a single statement instead of one
	// round-trip per id. Scoped to this environment to match the per-id loop.
	return db
		.delete(workspaceServiceLayouts)
		.where(
			and(
				eq(workspaceServiceLayouts.environmentId, environment.environmentId),
				inArray(workspaceServiceLayouts.layoutId, staleLayoutIds),
			),
		)
		.returning();
};
