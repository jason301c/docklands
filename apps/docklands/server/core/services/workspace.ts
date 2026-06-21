import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import {
	workspaceServiceConnections,
	workspaceServiceLayouts,
} from "@/server/core/db/schema";
import type { findEnvironmentById } from "@/server/core/services/environment";
import {
	extractWorkspaceServicesFromEnvironment,
	getWorkspaceServiceKey,
	resolveWorkspaceNodes,
	type WorkspaceServiceType,
} from "@/shared/workspace-graph";

type Environment = Awaited<ReturnType<typeof findEnvironmentById>>;

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
	if (
		input.sourceServiceType === input.targetServiceType &&
		input.sourceServiceId === input.targetServiceId
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
			...input,
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
