export const WORKSPACE_SERVICE_TYPES = [
	"application",
	"compose",
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
	"redis",
] as const;

export type WorkspaceServiceType = (typeof WORKSPACE_SERVICE_TYPES)[number];

export type WorkspaceServiceStatus = "idle" | "running" | "done" | "error";

export type WorkspaceService = {
	id: string;
	type: WorkspaceServiceType;
	name: string;
	description?: string | null;
	status?: WorkspaceServiceStatus | null;
	createdAt?: string | null;
	lastDeployAt?: string | null;
	serverId?: string | null;
	serverName?: string | null;
	icon?: string | null;
};

export type WorkspaceNodePosition = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type WorkspaceNode = WorkspaceNodePosition & {
	serviceId: string;
	serviceType: WorkspaceServiceType;
};

export type PersistedWorkspaceNode = Partial<WorkspaceNodePosition> & {
	serviceId: string;
	serviceType: WorkspaceServiceType;
};

export const WORKSPACE_NODE_WIDTH = 280;
export const WORKSPACE_NODE_HEIGHT = 164;
export const WORKSPACE_COLUMN_GAP = 120;
export const WORKSPACE_ROW_GAP = 96;
export const WORKSPACE_CANVAS_PADDING = 80;

const serviceDescriptors = {
	application: {
		collectionKey: "applications",
		idKey: "applicationId",
		statusKey: "applicationStatus",
	},
	compose: {
		collectionKey: "compose",
		idKey: "composeId",
		statusKey: "composeStatus",
	},
	libsql: {
		collectionKey: "libsql",
		idKey: "libsqlId",
		statusKey: "applicationStatus",
	},
	mariadb: {
		collectionKey: "mariadb",
		idKey: "mariadbId",
		statusKey: "applicationStatus",
	},
	mongo: {
		collectionKey: "mongo",
		idKey: "mongoId",
		statusKey: "applicationStatus",
	},
	mysql: {
		collectionKey: "mysql",
		idKey: "mysqlId",
		statusKey: "applicationStatus",
	},
	postgres: {
		collectionKey: "postgres",
		idKey: "postgresId",
		statusKey: "applicationStatus",
	},
	redis: {
		collectionKey: "redis",
		idKey: "redisId",
		statusKey: "applicationStatus",
	},
} satisfies Record<
	WorkspaceServiceType,
	{ collectionKey: string; idKey: string; statusKey: string }
>;

type EnvironmentLike = Record<string, unknown>;
type ServiceLike = Record<string, unknown>;

export const getWorkspaceServiceKey = (
	serviceType: WorkspaceServiceType,
	serviceId: string,
) => `${serviceType}:${serviceId}`;

export const isWorkspaceServiceType = (
	value: string,
): value is WorkspaceServiceType =>
	WORKSPACE_SERVICE_TYPES.includes(value as WorkspaceServiceType);

const asString = (value: unknown) =>
	typeof value === "string" && value.length > 0 ? value : null;

const getLatestDeploymentDate = (record: ServiceLike) => {
	const deployments = record.deployments;
	if (!Array.isArray(deployments)) return null;

	let latest: string | null = null;
	for (const deployment of deployments) {
		const deploymentRecord = deployment as ServiceLike;
		const candidate =
			asString(deploymentRecord.finishedAt) ||
			asString(deploymentRecord.startedAt) ||
			asString(deploymentRecord.createdAt);
		if (!candidate) continue;

		if (!latest || new Date(candidate).getTime() > new Date(latest).getTime()) {
			latest = candidate;
		}
	}

	return latest;
};

export const extractWorkspaceServicesFromEnvironment = (
	environment: EnvironmentLike | null | undefined,
): WorkspaceService[] => {
	if (!environment) return [];

	const services: WorkspaceService[] = [];

	for (const type of WORKSPACE_SERVICE_TYPES) {
		const descriptor = serviceDescriptors[type];
		const items = environment[descriptor.collectionKey];

		if (!Array.isArray(items)) continue;

		for (const item of items) {
			const record = item as ServiceLike;
			const id = asString(record[descriptor.idKey]);
			const name = asString(record.name);

			if (!id || !name) continue;

			const server = record.server as ServiceLike | undefined;

			services.push({
				id,
				type,
				name,
				description: asString(record.description),
				status: asString(
					record[descriptor.statusKey],
				) as WorkspaceServiceStatus | null,
				createdAt: asString(record.createdAt),
				lastDeployAt: getLatestDeploymentDate(record),
				serverId: asString(record.serverId),
				serverName: server ? asString(server.name) : null,
				icon: asString(record.icon),
			});
		}
	}

	return services.sort((a, b) => {
		const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
		const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
		return bDate - aDate;
	});
};

export const getDefaultWorkspacePosition = (
	index: number,
): WorkspaceNodePosition => {
	const columns = 3;
	const column = index % columns;
	const row = Math.floor(index / columns);

	return {
		x:
			WORKSPACE_CANVAS_PADDING +
			column * (WORKSPACE_NODE_WIDTH + WORKSPACE_COLUMN_GAP),
		y:
			WORKSPACE_CANVAS_PADDING +
			row * (WORKSPACE_NODE_HEIGHT + WORKSPACE_ROW_GAP),
		width: WORKSPACE_NODE_WIDTH,
		height: WORKSPACE_NODE_HEIGHT,
	};
};

export const resolveWorkspaceNodes = (
	services: WorkspaceService[],
	persistedNodes: PersistedWorkspaceNode[] = [],
): WorkspaceNode[] => {
	const persistedByService = new Map(
		persistedNodes.map((node) => [
			getWorkspaceServiceKey(node.serviceType, node.serviceId),
			node,
		]),
	);

	return services.map((service, index) => {
		const fallback = getDefaultWorkspacePosition(index);
		const persisted = persistedByService.get(
			getWorkspaceServiceKey(service.type, service.id),
		);

		return {
			serviceId: service.id,
			serviceType: service.type,
			x: persisted?.x ?? fallback.x,
			y: persisted?.y ?? fallback.y,
			width: persisted?.width ?? fallback.width,
			height: persisted?.height ?? fallback.height,
		};
	});
};
