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
	/** Host of the service's primary/first domain (no scheme). null for databases or when no domains. */
	primaryDomain?: string | null;
	/** True iff the service has at least one domain. Always false for databases. */
	exposed?: boolean;
	/** Number of domains attached. 0 for databases. */
	domainCount?: number;
	/** Named docker volumes mounted by the service (mount `type === "volume"`). */
	volumes?: { name: string }[];
	/** Human name of the runtime worker the service is placed on. null = automatic/local placement. */
	runtimeWorkerName?: string | null;
	/** Replica count for application/compose when the column exists; null for databases or when absent. */
	replicas?: number | null;
	/** Membership in a named canvas group, or null when the service is ungrouped. */
	groupId?: string | null;
};

/**
 * A named, colored container region on the canvas. A group is its own
 * positioned/sized node rendered *behind* the service cards; services belong to
 * it via membership (`WorkspaceService.groupId`) rather than React-Flow
 * parent/child relative positioning, so grouping never moves a service node.
 */
export type WorkspaceGroup = {
	groupId: string;
	environmentId: string;
	name: string;
	color: string | null;
	x: number;
	y: number;
	width: number;
	height: number;
};

export const WORKSPACE_GROUP_DEFAULT_WIDTH = 420;
export const WORKSPACE_GROUP_DEFAULT_HEIGHT = 320;

export type WorkspaceNodePosition = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type WorkspaceNode = WorkspaceNodePosition & {
	serviceId: string;
	serviceType: WorkspaceServiceType;
	groupId?: string | null;
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
	groupId?: string | null;
};

export const WORKSPACE_NODE_WIDTH = 280;
export const WORKSPACE_NODE_HEIGHT = 164;
export const WORKSPACE_COLUMN_GAP = 120;
export const WORKSPACE_ROW_GAP = 96;
export const WORKSPACE_CANVAS_PADDING = 80;

/**
 * The six managed-database engines now live in a single `database` collection
 * on the environment, discriminated by an `engine` column. Application and
 * compose keep their own per-collection relations.
 */
const NON_DATABASE_SERVICE_DESCRIPTORS = {
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
} satisfies Partial<
	Record<
		WorkspaceServiceType,
		{ collectionKey: string; idKey: string; statusKey: string }
	>
>;

/** The unified managed-database collection on the environment. */
const DATABASE_COLLECTION_KEY = "database";
/** The unified managed-database primary-key column. */
const DATABASE_ID_KEY = "databaseId";
/** The unified managed-database deploy-status column. */
const DATABASE_STATUS_KEY = "applicationStatus";

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

/**
 * Picks the primary domain host: the earliest by `createdAt` when present,
 * otherwise the first domain in the relation array. Returns just the hostname
 * (no scheme).
 */
const getPrimaryDomainHost = (record: ServiceLike) => {
	const domains = record.domains;
	if (!Array.isArray(domains) || domains.length === 0) return null;

	let primary: ServiceLike | null = null;
	let primaryCreatedAt: string | null = null;
	for (const domain of domains) {
		const domainRecord = domain as ServiceLike;
		if (!asString(domainRecord.host)) continue;

		if (!primary) {
			primary = domainRecord;
			primaryCreatedAt = asString(domainRecord.createdAt);
			continue;
		}

		const candidateCreatedAt = asString(domainRecord.createdAt);
		if (
			candidateCreatedAt &&
			(!primaryCreatedAt ||
				new Date(candidateCreatedAt).getTime() <
					new Date(primaryCreatedAt).getTime())
		) {
			primary = domainRecord;
			primaryCreatedAt = candidateCreatedAt;
		}
	}

	return primary ? asString(primary.host) : null;
};

const getDomainCount = (record: ServiceLike) => {
	const domains = record.domains;
	return Array.isArray(domains) ? domains.length : 0;
};

/** Collects named docker volumes (mount `type === "volume"`) by `volumeName`. */
const getNamedVolumes = (record: ServiceLike): { name: string }[] => {
	const mounts = record.mounts;
	if (!Array.isArray(mounts)) return [];

	const volumes: { name: string }[] = [];
	for (const mount of mounts) {
		const mountRecord = mount as ServiceLike;
		if (mountRecord.type !== "volume") continue;
		const name = asString(mountRecord.volumeName);
		if (!name) continue;
		volumes.push({ name });
	}

	return volumes;
};

const getRuntimeWorkerName = (record: ServiceLike) => {
	const runtimeWorker = record.runtimeWorker;
	if (!runtimeWorker || typeof runtimeWorker !== "object") return null;
	return asString((runtimeWorker as ServiceLike).name);
};

const getReplicas = (record: ServiceLike) => {
	const replicas = record.replicas;
	return typeof replicas === "number" ? replicas : null;
};

const toWorkspaceService = (
	record: ServiceLike,
	type: WorkspaceServiceType,
	idKey: string,
	statusKey: string,
): WorkspaceService | null => {
	const id = asString(record[idKey]);
	const name = asString(record.name);

	if (!id || !name) return null;

	const domainCount = getDomainCount(record);

	return {
		id,
		type,
		name,
		appName: asString(record.appName),
		description: asString(record.description),
		status: asString(record[statusKey]) as WorkspaceServiceStatus | null,
		createdAt: asString(record.createdAt),
		lastDeployAt: getLatestDeploymentDate(record),
		runtimeWorkerId: asString(record.runtimeWorkerId),
		refreshToken: asString(record.refreshToken),
		composeType:
			record.composeType === "docker-compose" || record.composeType === "stack"
				? record.composeType
				: null,
		icon: asString(record.icon),
		primaryDomain: getPrimaryDomainHost(record),
		exposed: domainCount > 0,
		domainCount,
		volumes: getNamedVolumes(record),
		runtimeWorkerName: getRuntimeWorkerName(record),
		replicas: getReplicas(record),
		// Membership is layout metadata, so it is overlaid from the layout rows in
		// `getEnvironmentWorkspace`; the bare service record carries no group.
		groupId: null,
	};
};

export const extractWorkspaceServicesFromEnvironment = (
	environment: EnvironmentLike | null | undefined,
): WorkspaceService[] => {
	if (!environment) return [];

	const services: WorkspaceService[] = [];

	// Application and compose keep their own per-collection relations.
	for (const [type, descriptor] of Object.entries(
		NON_DATABASE_SERVICE_DESCRIPTORS,
	) as [
		WorkspaceServiceType,
		(typeof NON_DATABASE_SERVICE_DESCRIPTORS)[keyof typeof NON_DATABASE_SERVICE_DESCRIPTORS],
	][]) {
		const items = environment[descriptor.collectionKey];
		if (!Array.isArray(items)) continue;

		for (const item of items) {
			const service = toWorkspaceService(
				item as ServiceLike,
				type,
				descriptor.idKey,
				descriptor.statusKey,
			);
			if (service) services.push(service);
		}
	}

	// The six managed-database engines now live in one `database` collection,
	// discriminated by the row's `engine`, which maps to the node type.
	const databaseItems = environment[DATABASE_COLLECTION_KEY];
	if (Array.isArray(databaseItems)) {
		for (const item of databaseItems) {
			const record = item as ServiceLike;
			const engine = asString(record.engine);
			if (!engine || !isWorkspaceServiceType(engine)) continue;

			const service = toWorkspaceService(
				record,
				engine,
				DATABASE_ID_KEY,
				DATABASE_STATUS_KEY,
			);
			if (service) services.push(service);
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
			groupId: persisted?.groupId ?? null,
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
