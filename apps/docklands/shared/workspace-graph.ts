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

export const WORKSPACE_VARIABLE_SOURCE_TYPES = [
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
	"redis",
] as const satisfies readonly WorkspaceServiceType[];

export type WorkspaceVariableSourceType =
	(typeof WORKSPACE_VARIABLE_SOURCE_TYPES)[number];

export type WorkspaceServiceStatus = "idle" | "running" | "done" | "error";

export type WorkspaceService = {
	id: string;
	type: WorkspaceServiceType;
	name: string;
	appName?: string | null;
	description?: string | null;
	status?: WorkspaceServiceStatus | null;
	createdAt?: string | null;
	lastDeployAt?: string | null;
	runtimeWorkerId?: string | null;
	refreshToken?: string | null;
	composeType?: "docker-compose" | "stack" | null;
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

export type WorkspaceConnectionLike = {
	sourceServiceType: WorkspaceServiceType;
	sourceServiceId: string;
	targetServiceType: WorkspaceServiceType;
	targetServiceId: string;
};

export type WorkspaceConnectionGroup = WorkspaceNodePosition & {
	id: string;
	nodeKeys: string[];
};

export type WorkspaceTopologyCounts = {
	services: number;
	running: number;
	errors: number;
	connections: number;
	unlinked: number;
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

export const canWorkspaceServiceExposeVariables = (
	serviceType: WorkspaceServiceType,
): serviceType is WorkspaceVariableSourceType =>
	WORKSPACE_VARIABLE_SOURCE_TYPES.includes(
		serviceType as WorkspaceVariableSourceType,
	);

type WorkspaceServiceRef = {
	serviceType: WorkspaceServiceType;
	serviceId: string;
};

export const normalizeWorkspaceConnectionEndpoints = <
	TSource extends WorkspaceServiceRef,
	TTarget extends WorkspaceServiceRef,
>(
	source: TSource,
	target: TTarget,
) => {
	const sourceCanExposeVariables = canWorkspaceServiceExposeVariables(
		source.serviceType,
	);
	const targetCanExposeVariables = canWorkspaceServiceExposeVariables(
		target.serviceType,
	);

	if (!sourceCanExposeVariables && targetCanExposeVariables) {
		return { source: target, target: source, flipped: true };
	}

	return { source, target, flipped: false };
};

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

			services.push({
				id,
				type,
				name,
				appName: asString(record.appName),
				description: asString(record.description),
				status: asString(
					record[descriptor.statusKey],
				) as WorkspaceServiceStatus | null,
				createdAt: asString(record.createdAt),
				lastDeployAt: getLatestDeploymentDate(record),
				runtimeWorkerId: asString(record.runtimeWorkerId),
				refreshToken: asString(record.refreshToken),
				composeType:
					record.composeType === "docker-compose" ||
					record.composeType === "stack"
						? record.composeType
						: null,
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

export const resolveWorkspaceConnectionGroups = (
	nodes: WorkspaceNode[],
	connections: WorkspaceConnectionLike[] = [],
	padding = 48,
): WorkspaceConnectionGroup[] => {
	const nodesByKey = new Map(
		nodes.map((node) => [
			getWorkspaceServiceKey(node.serviceType, node.serviceId),
			node,
		]),
	);
	const adjacency = new Map<string, Set<string>>();

	for (const connection of connections) {
		const sourceKey = getWorkspaceServiceKey(
			connection.sourceServiceType,
			connection.sourceServiceId,
		);
		const targetKey = getWorkspaceServiceKey(
			connection.targetServiceType,
			connection.targetServiceId,
		);

		if (!nodesByKey.has(sourceKey) || !nodesByKey.has(targetKey)) continue;

		if (!adjacency.has(sourceKey)) adjacency.set(sourceKey, new Set());
		if (!adjacency.has(targetKey)) adjacency.set(targetKey, new Set());
		adjacency.get(sourceKey)?.add(targetKey);
		adjacency.get(targetKey)?.add(sourceKey);
	}

	const visited = new Set<string>();
	const groups: WorkspaceConnectionGroup[] = [];

	for (const key of adjacency.keys()) {
		if (visited.has(key)) continue;

		const nodeKeys: string[] = [];
		const stack = [key];
		visited.add(key);

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;
			nodeKeys.push(current);

			for (const next of adjacency.get(current) ?? []) {
				if (visited.has(next)) continue;
				visited.add(next);
				stack.push(next);
			}
		}

		if (nodeKeys.length < 2) continue;

		const groupNodes = nodeKeys
			.map((nodeKey) => nodesByKey.get(nodeKey))
			.filter((node): node is WorkspaceNode => Boolean(node));
		const minX = Math.min(...groupNodes.map((node) => node.x));
		const minY = Math.min(...groupNodes.map((node) => node.y));
		const maxX = Math.max(...groupNodes.map((node) => node.x + node.width));
		const maxY = Math.max(...groupNodes.map((node) => node.y + node.height));
		const x = Math.max(24, minX - padding);
		const y = Math.max(24, minY - padding);

		groups.push({
			id: nodeKeys.sort().join("|"),
			nodeKeys,
			x,
			y,
			width: maxX + padding - x,
			height: maxY + padding - y,
		});
	}

	return groups.sort((a, b) => a.y - b.y || a.x - b.x);
};

export const countWorkspaceTopology = (
	services: WorkspaceService[],
	connections: WorkspaceConnectionLike[] = [],
): WorkspaceTopologyCounts => {
	const linkedServiceKeys = new Set<string>();

	for (const connection of connections) {
		linkedServiceKeys.add(
			getWorkspaceServiceKey(
				connection.sourceServiceType,
				connection.sourceServiceId,
			),
		);
		linkedServiceKeys.add(
			getWorkspaceServiceKey(
				connection.targetServiceType,
				connection.targetServiceId,
			),
		);
	}

	return {
		services: services.length,
		running: services.filter((service) => service.status === "running").length,
		errors: services.filter((service) => service.status === "error").length,
		connections: connections.length,
		unlinked: services.filter(
			(service) =>
				!linkedServiceKeys.has(
					getWorkspaceServiceKey(service.type, service.id),
				),
		).length,
	};
};
