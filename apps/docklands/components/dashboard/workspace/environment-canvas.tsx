"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowRight,
	ArrowUpDown,
	Box,
	Cable,
	CheckCircle2,
	CircuitBoard,
	Clock,
	Command,
	Database,
	ExternalLink,
	FileInput,
	Folder,
	FolderInput,
	GitPullRequest,
	GlobeIcon,
	Grip,
	Loader2,
	Network,
	Play,
	PlusIcon,
	PuzzleIcon,
	RefreshCw,
	Rocket,
	Search,
	ServerIcon,
	Settings2,
	SquareTerminal,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type PointerEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { ShowPorts } from "@/components/dashboard/application/advanced/ports/show-port";
import { ShowResources } from "@/components/dashboard/application/advanced/show-resources";
import { ShowVolumes } from "@/components/dashboard/application/advanced/volumes/show-volumes";
import { ShowDeployments } from "@/components/dashboard/application/deployments/show-deployments";
import { ShowDomains } from "@/components/dashboard/application/domains/show-domains";
import { ShowApplicationEnvironment } from "@/components/dashboard/application/environment/show";
import { ShowServiceEnvironment } from "@/components/dashboard/application/environment/show-environment";
import { ShowDockerLogs } from "@/components/dashboard/application/logs/show";
import { ShowPreviewDeployments } from "@/components/dashboard/application/preview-deployments/show-preview-deployments";
import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { ShowVolumeBackups } from "@/components/dashboard/application/volume-backups/show-volume-backups";
import { ShowComposeContainers } from "@/components/dashboard/compose/containers/show-compose-containers";
import { DeleteService } from "@/components/dashboard/compose/delete-service";
import { ShowDockerLogsCompose } from "@/components/dashboard/compose/logs/show";
import { ShowDockerLogsStack } from "@/components/dashboard/compose/logs/show-stack";
import { ServiceTerminalModal } from "@/components/dashboard/container-runtime/terminal/service-terminal-modal";
import { ShowBackups } from "@/components/dashboard/database-service/backups/show-backups";
import { ShowExternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-external-database-credentials";
import { ShowInternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-internal-database-credentials";
import { ComposeMonitoring } from "@/components/dashboard/metrics/container/show-compose-monitoring";
import { ContainerMonitoring } from "@/components/dashboard/metrics/container/show-container-monitoring";
import { AddApplication } from "@/components/dashboard/workspace/actions/add-application";
import { AddCompose } from "@/components/dashboard/workspace/actions/add-compose";
import { AddDatabase } from "@/components/dashboard/workspace/actions/add-database";
import { AddImport } from "@/components/dashboard/workspace/actions/add-import";
import { AddTemplate } from "@/components/dashboard/workspace/actions/add-template";
import { AdvancedEnvironmentSelector } from "@/components/dashboard/workspace/actions/advanced-environment-selector";
import { EnvironmentVariables } from "@/components/dashboard/workspace/actions/environment-variables";
import { BulkDeleteDialog } from "@/components/dashboard/workspace/canvas/bulk-delete-dialog";
import {
	CommandBarDialog,
	type CommandGroup,
	type CommandItem,
} from "@/components/dashboard/workspace/canvas/command-bar-dialog";
import { serviceTypeLabels } from "@/components/dashboard/workspace/canvas/constants";
import { DuplicateServicesDialog } from "@/components/dashboard/workspace/canvas/duplicate-services-dialog";
import { MoveServicesDialog } from "@/components/dashboard/workspace/canvas/move-services-dialog";
import { WorkspaceVariables } from "@/components/dashboard/workspace/manage/workspace-variables";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { AdvanceBreadcrumb } from "@/components/shared/advance-breadcrumb";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";
import { ErrorState } from "@/components/shared/states";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import { toast } from "@/components/shared/toast";
import { parseEnvironmentVariables } from "@/shared/env-string";
import {
	workspaceEnvironmentPath,
	workspaceServicePath,
} from "@/shared/routes";
import { cn } from "@/shared/utils";
import {
	canWorkspaceServiceExposeVariables,
	countWorkspaceTopology,
	getDefaultWorkspacePosition,
	getWorkspaceServiceKey,
	isWorkspaceServiceType,
	normalizeWorkspaceConnectionEndpoints,
	resolveWorkspaceConnectionGroups,
	type WorkspaceNode,
	type WorkspaceService,
	type WorkspaceServiceStatus,
	type WorkspaceServiceType,
} from "@/shared/workspace-graph";

const logger = createClientLogger("workspace-canvas");

type WorkspaceData = RouterOutputs["workspaceGraph"]["byEnvironment"];
type WorkspaceConnection = WorkspaceData["connections"][number];

type SelectedServiceRef = {
	serviceId: string;
	serviceType: WorkspaceServiceType;
};

type DragState = {
	key: string;
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
	moved: boolean;
};

type CreateServiceDialog =
	| "application"
	| "database"
	| "compose"
	| "template"
	| "import";

type CreateDatabaseType =
	| "libsql"
	| "mariadb"
	| "mongo"
	| "mysql"
	| "postgres"
	| "redis";

type ServiceKindFilter =
	| "all"
	| "runtimes"
	| "databases"
	| WorkspaceServiceType;
type ServiceStatusFilter = "all" | NonNullable<WorkspaceService["status"]>;
type ServiceSort =
	| "manual"
	| "name-asc"
	| "type-asc"
	| "status-asc"
	| "last-deploy-desc";

const deploymentServiceTypes = new Set<WorkspaceServiceType>([
	"application",
	"compose",
]);

const databaseBackupServiceTypes = new Set<WorkspaceServiceType>([
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
]);

const databaseCredentialServiceTypes = new Set<WorkspaceServiceType>([
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
	"redis",
]);

const serviceKindFilterOptions: { value: ServiceKindFilter; label: string }[] =
	[
		{ value: "all", label: "All types" },
		{ value: "runtimes", label: "Apps & stacks" },
		{ value: "databases", label: "Databases" },
		{ value: "application", label: "Applications" },
		{ value: "compose", label: "Compose" },
		{ value: "postgres", label: "PostgreSQL" },
		{ value: "mysql", label: "MySQL" },
		{ value: "mariadb", label: "MariaDB" },
		{ value: "mongo", label: "MongoDB" },
		{ value: "redis", label: "Redis" },
		{ value: "libsql", label: "LibSQL" },
	];

const serviceStatusFilterOptions: {
	value: ServiceStatusFilter;
	label: string;
}[] = [
	{ value: "all", label: "All statuses" },
	{ value: "running", label: "Running" },
	{ value: "error", label: "Errors" },
	{ value: "done", label: "Done" },
	{ value: "idle", label: "Idle" },
];

const serviceSortOptions: { value: ServiceSort; label: string }[] = [
	{ value: "manual", label: "Manual layout" },
	{ value: "name-asc", label: "Name" },
	{ value: "type-asc", label: "Type" },
	{ value: "status-asc", label: "Status" },
	{ value: "last-deploy-desc", label: "Recent deployment" },
];

const serviceTypeDescriptions: Record<WorkspaceServiceType, string> = {
	application: "Code service",
	compose: "Stack",
	libsql: "SQLite-compatible database",
	mariadb: "Relational database",
	mongo: "Document database",
	mysql: "Relational database",
	postgres: "Relational database",
	redis: "Cache",
};

const serviceIconClassName = "size-6 text-kumo-subtle";

const WorkspaceServiceIcon = ({ service }: { service: WorkspaceService }) => {
	if (service.type === "application") {
		if (service.icon) {
			return (
				<img
					src={service.icon}
					alt=""
					className="size-7 object-contain"
					aria-hidden="true"
				/>
			);
		}
		return <GlobeIcon className={serviceIconClassName} />;
	}

	if (service.type === "compose")
		return <CircuitBoard className={serviceIconClassName} />;
	if (service.type === "libsql")
		return <LibsqlIcon className={serviceIconClassName} />;
	if (service.type === "mariadb")
		return <MariadbIcon className={serviceIconClassName} />;
	if (service.type === "mongo")
		return <MongodbIcon className={serviceIconClassName} />;
	if (service.type === "mysql")
		return <MysqlIcon className={serviceIconClassName} />;
	if (service.type === "postgres")
		return <PostgresqlIcon className={serviceIconClassName} />;
	if (service.type === "redis")
		return <RedisIcon className={serviceIconClassName} />;

	return <Database className={serviceIconClassName} />;
};

const pulseToneClass: Record<WorkspaceServiceStatus, string> = {
	done: "bg-kumo-info",
	error: "bg-kumo-danger",
	idle: "bg-kumo-subtle/40",
	running: "bg-kumo-success",
};

const getServicePulseBars = (service: WorkspaceService, linkCount: number) => {
	const seed = [...service.id].reduce(
		(total, char) => total + char.charCodeAt(0),
		0,
	);
	const deployAge = service.lastDeployAt
		? Date.now() - new Date(service.lastDeployAt).getTime()
		: Number.POSITIVE_INFINITY;
	const recentDeployBoost = deployAge < 1000 * 60 * 60 * 24 ? 16 : 0;
	const runningBoost = service.status === "running" ? 10 : 0;

	return Array.from({ length: 12 }, (_, index) => {
		const value =
			18 +
			((seed + index * 17 + linkCount * 11) % 44) +
			recentDeployBoost +
			runningBoost;
		return Math.min(82, value);
	});
};

const ServiceRuntimePulse = ({
	service,
	linkCount,
}: {
	service: WorkspaceService;
	linkCount: number;
}) => {
	const tone = pulseToneClass[service.status ?? "idle"];
	const bars = getServicePulseBars(service, linkCount);

	return (
		<div
			className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md border bg-kumo-canvas/95 px-2 py-1.5 opacity-0 shadow-sm transition group-hover:opacity-100"
			aria-hidden="true"
		>
			<div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase text-kumo-subtle">
				<span>Runtime pulse</span>
				<span>{linkCount} links</span>
			</div>
			<div className="flex h-8 items-end gap-1">
				{bars.map((height, index) => (
					<span
						key={`${service.id}-${index}`}
						className={cn("w-full rounded-sm opacity-80", tone)}
						style={{ height: `${height}%` }}
					/>
				))}
			</div>
		</div>
	);
};

const ConnectionVariablePreview = ({
	connectionId,
	enabled,
}: {
	connectionId: string;
	enabled: boolean;
}) => {
	const variablesQuery = api.workspaceGraph.connectionVariables.useQuery(
		{ connectionId },
		{ enabled },
	);

	if (!enabled) return null;

	if (variablesQuery.isPending) {
		return <p className="text-xs text-kumo-subtle">Loading variable keys...</p>;
	}

	if (!variablesQuery.data?.length) {
		return (
			<p className="text-xs text-kumo-subtle">
				No generated variables for this source.
			</p>
		);
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			{variablesQuery.data.map((variable) => (
				<Badge key={variable.key}>{variable.key}</Badge>
			))}
		</div>
	);
};

const WorkspaceServiceFlowNode = ({
	service,
	serviceType,
	fallbackLabel,
}: {
	service?: WorkspaceService;
	serviceType: WorkspaceServiceType;
	fallbackLabel: string;
}) => (
	<div className="min-w-0 rounded-md border bg-kumo-canvas px-3 py-2">
		<div className="flex min-w-0 items-center gap-2">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/30">
				{service ? (
					<WorkspaceServiceIcon service={service} />
				) : (
					<Network className="size-4 text-kumo-subtle" />
				)}
			</div>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">
					{service?.name ?? fallbackLabel}
				</p>
				<p className="truncate text-xs text-kumo-subtle">
					{serviceTypeLabels[service?.type ?? serviceType] ?? serviceType}
				</p>
			</div>
		</div>
	</div>
);

const ConnectionVariableFlowCard = ({
	connection,
	source,
	target,
	variablePreviewEnabled,
	actions,
}: {
	connection: WorkspaceConnection;
	source?: WorkspaceService;
	target?: WorkspaceService;
	variablePreviewEnabled: boolean;
	actions?: ReactNode;
}) => (
	<div className="space-y-3 rounded-md border bg-kumo-canvas/80 p-3">
		<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
			<WorkspaceServiceFlowNode
				service={source}
				serviceType={connection.sourceServiceType}
				fallbackLabel="Unknown source"
			/>
			<div className="flex size-8 items-center justify-center rounded-full border bg-kumo-fill/30">
				<ArrowRight className="size-4 text-kumo-subtle" />
			</div>
			<WorkspaceServiceFlowNode
				service={target}
				serviceType={connection.targetServiceType}
				fallbackLabel="Unknown target"
			/>
		</div>

		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0 flex-1 space-y-2">
				<div className="flex flex-wrap items-center gap-1.5">
					<Badge>{connection.label || "Private network"}</Badge>
					<Badge>Generated variables</Badge>
				</div>
				<ConnectionVariablePreview
					connectionId={connection.connectionId}
					enabled={variablePreviewEnabled}
				/>
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-1">{actions}</div>
			) : null}
		</div>
	</div>
);

const nodeCenter = (node: WorkspaceNode) => ({
	x: node.x + node.width / 2,
	y: node.y + node.height / 2,
});

const connectionPath = (source: WorkspaceNode, target: WorkspaceNode) => {
	const from = nodeCenter(source);
	const to = nodeCenter(target);
	const distance = Math.max(80, Math.abs(to.x - from.x) / 2);
	return `M ${from.x} ${from.y} C ${from.x + distance} ${from.y}, ${to.x - distance} ${to.y}, ${to.x} ${to.y}`;
};

const connectionPreviewPath = (
	source: WorkspaceNode,
	pointer: { x: number; y: number },
) => {
	const from = nodeCenter(source);
	const distance = Math.max(80, Math.abs(pointer.x - from.x) / 2);
	return `M ${from.x} ${from.y} C ${from.x + distance} ${from.y}, ${pointer.x - distance} ${pointer.y}, ${pointer.x} ${pointer.y}`;
};

const getActionInput = (service: WorkspaceService) => {
	switch (service.type) {
		case "application":
			return { applicationId: service.id };
		case "compose":
			return { composeId: service.id };
		default:
			// all managed database engines resolve to the unified database router
			return { databaseId: service.id };
	}
};

const getDeleteInput = (service: WorkspaceService, deleteVolumes: boolean) => {
	if (service.type === "compose") {
		return { composeId: service.id, deleteVolumes };
	}

	return getActionInput(service);
};

const getServiceSettingsHref = (
	workspaceId: string,
	environmentId: string,
	service: WorkspaceService,
) =>
	workspaceServicePath({
		workspaceId: workspaceId,
		environmentId,
		serviceType: service.type,
		serviceId: service.id,
	});

const formatLastDeployment = (lastDeployAt?: string | null) =>
	lastDeployAt
		? formatDistanceToNow(new Date(lastDeployAt), { addSuffix: true })
		: "No deployments yet";

const getDatabaseBackupType = (service: WorkspaceService) =>
	databaseBackupServiceTypes.has(service.type)
		? (service.type as "libsql" | "mariadb" | "mongo" | "mysql" | "postgres")
		: undefined;

const hasDatabaseCredentials = (service: WorkspaceService) =>
	databaseCredentialServiceTypes.has(service.type);

const DatabaseCredentials = ({ service }: { service: WorkspaceService }) => {
	if (!databaseCredentialServiceTypes.has(service.type)) return null;
	return (
		<div className="space-y-4">
			<ShowInternalDatabaseCredentials databaseId={service.id} />
			<ShowExternalDatabaseCredentials databaseId={service.id} />
		</div>
	);
};

const ServiceTerminalButton = ({
	service,
	className,
}: {
	service: WorkspaceService;
	className?: string;
}) => {
	if (!service.appName) return null;

	return (
		<ServiceTerminalModal
			appName={service.appName}
			runtimeWorkerId={service.runtimeWorkerId || ""}
			appType={
				service.type === "compose"
					? service.composeType || "docker-compose"
					: undefined
			}
		>
			<Button variant="outline" className={className}>
				<SquareTerminal className="size-4" />
				Open terminal
			</Button>
		</ServiceTerminalModal>
	);
};

export const EnvironmentCanvas = ({
	workspaceId,
	environmentId,
}: {
	workspaceId: string;
	environmentId: string;
}) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const utils = api.useUtils();
	const { permissions } = usePermissions();
	const workspaceQuery = api.workspaceGraph.byEnvironment.useQuery({
		environmentId,
	});
	const workspace = workspaceQuery.data;
	const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
	const [selectedService, setSelectedService] =
		useState<SelectedServiceRef | null>(null);
	const [connectSource, setConnectSource] = useState<SelectedServiceRef | null>(
		null,
	);
	const [isTopologyOpen, setIsTopologyOpen] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [commandQuery, setCommandQuery] = useState("");
	const [serviceKindFilter, setServiceKindFilter] =
		useState<ServiceKindFilter>("all");
	const [serviceStatusFilter, setServiceStatusFilter] =
		useState<ServiceStatusFilter>("all");
	const [serviceSort, setServiceSort] = useState<ServiceSort>("manual");
	const [commandOpen, setCommandOpen] = useState(false);
	const [createDialog, setCreateDialog] = useState<CreateServiceDialog | null>(
		null,
	);
	const [createDatabaseType, setCreateDatabaseType] =
		useState<CreateDatabaseType>();
	const [drawerTab, setDrawerTab] = useState<
		| "overview"
		| "variables"
		| "deployments"
		| "domains"
		| "previews"
		| "logs"
		| "terminal"
		| "containers"
		| "metrics"
		| "schedules"
		| "backups"
		| "volume-backups"
		| "credentials"
		| "resources"
		| "connections"
	>("overview");
	const [isArranging, setIsArranging] = useState(false);
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [selectedBulkKeys, setSelectedBulkKeys] = useState<string[]>([]);
	const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
	const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
	const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
	const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
	const [deleteComposeVolumes, setDeleteComposeVolumes] = useState(false);
	const [duplicateMode, setDuplicateMode] = useState<
		"new-workspace" | "existing-environment"
	>("new-workspace");
	const [duplicateName, setDuplicateName] = useState("");
	const [duplicateDescription, setDuplicateDescription] = useState("");
	const [duplicateTargetProject, setDuplicateTargetProject] = useState("");
	const [duplicateTargetEnvironment, setDuplicateTargetEnvironment] =
		useState("");
	const [selectedTargetProject, setSelectedTargetProject] = useState("");
	const [selectedTargetEnvironment, setSelectedTargetEnvironment] =
		useState("");
	const [connectionPointer, setConnectionPointer] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const dragState = useRef<DragState | null>(null);
	const suppressClick = useRef(false);
	// Node keys whose local position is being (or was just) saved. While a key is
	// here, the server-sync effect preserves the locally-moved position instead of
	// clobbering it with a possibly-stale refetch — this prevents a card from
	// snapping back when a concurrent drag's save lands between our drag and the
	// refetch that reflects it.
	const pendingNodeKeys = useRef<Set<string>>(new Set());
	const { data: allWorkspaces } = api.workspaces.all.useQuery(undefined, {
		enabled: isSelectionMode,
	});
	const { data: workspaceEnvironments } =
		api.environment.byWorkspaceId.useQuery(
			{ workspaceId },
			{ enabled: commandOpen },
		);
	const { data: selectedProjectEnvironments } =
		api.environment.byWorkspaceId.useQuery(
			{ workspaceId: selectedTargetProject },
			{ enabled: isMoveDialogOpen && !!selectedTargetProject },
		);
	const { data: duplicateProjectEnvironments } =
		api.environment.byWorkspaceId.useQuery(
			{ workspaceId: duplicateTargetProject },
			{ enabled: isDuplicateDialogOpen && !!duplicateTargetProject },
		);

	const updateNode = api.workspaceGraph.updateNode.useMutation();
	const connect = api.workspaceGraph.connect.useMutation();
	const removeConnection = api.workspaceGraph.removeConnection.useMutation();
	const applyConnectionVariables =
		api.workspaceGraph.applyConnectionVariables.useMutation();
	const syncConnectionVariables =
		api.workspaceGraph.syncServiceConnectionVariables.useMutation();
	const duplicateProject = api.workspaces.duplicate.useMutation();
	const duplicateEnvironment = api.environment.duplicate.useMutation();

	const serviceActions = {
		application: {
			start: api.application.start.useMutation(),
			stop: api.application.stop.useMutation(),
			deploy: api.application.deploy.useMutation(),
			move: api.application.move.useMutation(),
			delete: api.application.delete.useMutation(),
		},
		compose: {
			start: api.compose.start.useMutation(),
			stop: api.compose.stop.useMutation(),
			deploy: api.compose.deploy.useMutation(),
			move: api.compose.move.useMutation(),
			delete: api.compose.delete.useMutation(),
		},
		database: {
			start: api.database.start.useMutation(),
			stop: api.database.stop.useMutation(),
			deploy: api.database.deploy.useMutation(),
			move: api.database.move.useMutation(),
			delete: api.database.remove.useMutation(),
		},
	};

	// Managed database engines all dispatch to the unified `database` actions.
	const getServiceActions = (type: WorkspaceService["type"]) =>
		type === "application" || type === "compose"
			? serviceActions[type]
			: serviceActions.database;

	useEffect(() => {
		const serverNodes = workspace?.nodes;
		if (!serverNodes) return;
		// Fast path: nothing in flight, take the server snapshot as-is.
		if (pendingNodeKeys.current.size === 0) {
			setNodes(serverNodes);
			return;
		}
		// Preserve the locally-moved position for any node whose save is pending or
		// just settled; everything else updates from the server.
		setNodes((current) => {
			const localByKey = new Map(
				current.map((node) => [
					getWorkspaceServiceKey(node.serviceType, node.serviceId),
					node,
				]),
			);
			return serverNodes.map((serverNode) => {
				const key = getWorkspaceServiceKey(
					serverNode.serviceType,
					serverNode.serviceId,
				);
				if (!pendingNodeKeys.current.has(key)) return serverNode;
				const localNode = localByKey.get(key);
				if (!localNode) return serverNode;
				// Keep our position; accept any other server-side changes.
				return { ...serverNode, x: localNode.x, y: localNode.y };
			});
		});
	}, [workspace?.nodes]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setCommandQuery("");
				setCommandOpen(true);
			}
			if (event.key === "Escape") {
				setConnectSource(null);
				setConnectionPointer(null);
				setCommandOpen(false);
				setCommandQuery("");
				setCreateDialog(null);
				setCreateDatabaseType(undefined);
				setIsMoveDialogOpen(false);
				setIsBulkDeleteDialogOpen(false);
				setIsDuplicateDialogOpen(false);
				setIsSelectionMode(false);
				setSelectedBulkKeys([]);
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const services = useMemo(
		() => workspace?.services ?? [],
		[workspace?.services],
	);
	const servicesByKey = useMemo(
		() =>
			new Map(
				services.map((service) => [
					getWorkspaceServiceKey(service.type, service.id),
					service,
				]),
			),
		[services],
	);
	const nodesByKey = useMemo(
		() =>
			new Map(
				nodes.map((node) => [
					getWorkspaceServiceKey(node.serviceType, node.serviceId),
					node,
				]),
			),
		[nodes],
	);
	const selectedBulkKeySet = useMemo(
		() => new Set(selectedBulkKeys),
		[selectedBulkKeys],
	);
	const selectedBulkServices = useMemo(
		() =>
			services.filter((service) =>
				selectedBulkKeySet.has(
					getWorkspaceServiceKey(service.type, service.id),
				),
			),
		[services, selectedBulkKeySet],
	);
	const selectedBulkRunningServices = useMemo(
		() =>
			selectedBulkServices.filter((service) => service.status === "running"),
		[selectedBulkServices],
	);
	const targetEnvironments = useMemo(
		() =>
			(selectedProjectEnvironments ?? []).filter(
				(environment) => environment.environmentId !== environmentId,
			),
		[selectedProjectEnvironments, environmentId],
	);
	useEffect(() => {
		setSelectedBulkKeys((current) => {
			const next = current.filter((key) => servicesByKey.has(key));
			return next.length === current.length ? current : next;
		});
	}, [servicesByKey]);

	const selectedServiceModel = selectedService
		? servicesByKey.get(
				getWorkspaceServiceKey(
					selectedService.serviceType,
					selectedService.serviceId,
				),
			)
		: null;
	const queryServiceType = searchParams.get("serviceType");
	const queryServiceId = searchParams.get("serviceId");

	useEffect(() => {
		if (
			!queryServiceId ||
			!queryServiceType ||
			!isWorkspaceServiceType(queryServiceType)
		) {
			return;
		}

		if (
			!servicesByKey.has(
				getWorkspaceServiceKey(queryServiceType, queryServiceId),
			)
		) {
			return;
		}

		if (
			selectedService?.serviceId === queryServiceId &&
			selectedService.serviceType === queryServiceType
		) {
			return;
		}

		setSelectedService({
			serviceId: queryServiceId,
			serviceType: queryServiceType,
		});
		setDrawerTab("overview");
	}, [queryServiceId, queryServiceType, selectedService, servicesByKey]);

	const drawerTabs = [
		{ value: "overview", label: "Overview" },
		{ value: "variables", label: "Variables" },
		...(selectedServiceModel &&
		deploymentServiceTypes.has(selectedServiceModel.type) &&
		permissions?.deployment.read
			? [{ value: "deployments", label: "Deployments" }]
			: []),
		...(selectedServiceModel &&
		deploymentServiceTypes.has(selectedServiceModel.type) &&
		permissions?.domain.read
			? [{ value: "domains", label: "Domains" }]
			: []),
		...(selectedServiceModel?.type === "application"
			? [{ value: "previews", label: "Previews" }]
			: []),
		...(selectedServiceModel &&
		deploymentServiceTypes.has(selectedServiceModel.type) &&
		permissions?.schedule.read
			? [{ value: "schedules", label: "Automations" }]
			: []),
		...(selectedServiceModel?.type === "compose" ||
		(selectedServiceModel && getDatabaseBackupType(selectedServiceModel))
			? [{ value: "backups", label: "Backups" }]
			: []),
		...(selectedServiceModel &&
		(permissions?.service.create || permissions?.volume.read)
			? [{ value: "resources", label: "Resources" }]
			: []),
		...(selectedServiceModel && hasDatabaseCredentials(selectedServiceModel)
			? [{ value: "credentials", label: "Credentials" }]
			: []),
		...(selectedServiceModel &&
		deploymentServiceTypes.has(selectedServiceModel.type) &&
		permissions?.volumeBackup.read
			? [{ value: "volume-backups", label: "Volume Backups" }]
			: []),
		...(selectedServiceModel?.appName && permissions?.logs.read
			? [{ value: "logs", label: "Logs" }]
			: []),
		...(selectedServiceModel?.appName && permissions?.service.read
			? [{ value: "terminal", label: "Terminal" }]
			: []),
		...(selectedServiceModel?.type === "compose" && permissions?.service.read
			? [{ value: "containers", label: "Containers" }]
			: []),
		...(selectedServiceModel?.appName && permissions?.monitoring.read
			? [{ value: "metrics", label: "Metrics" }]
			: []),
		{ value: "connections", label: "Connections" },
	];

	// The visible `drawerTabs` list already encodes every per-service and
	// permission visibility rule, so derive the active tab by clamping to a valid
	// one. This replaces a 13-dependency effect that imperatively reset the tab to
	// "overview" after the fact (which re-ran on every drag/permission change).
	const activeDrawerTab = drawerTabs.some((tab) => tab.value === drawerTab)
		? drawerTab
		: "overview";

	const hasCanvasFilters =
		searchQuery.trim().length > 0 ||
		serviceKindFilter !== "all" ||
		serviceStatusFilter !== "all";
	const canvasFilterCount = [
		searchQuery.trim().length > 0,
		serviceKindFilter !== "all",
		serviceStatusFilter !== "all",
	].filter(Boolean).length;

	const filteredServices = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		let nextServices = services.filter((service) => {
			const matchesSearch =
				!query ||
				service.name.toLowerCase().includes(query) ||
				service.type.toLowerCase().includes(query) ||
				service.description?.toLowerCase().includes(query) ||
				service.status?.toLowerCase().includes(query);

			const matchesKind =
				serviceKindFilter === "all" ||
				(serviceKindFilter === "runtimes" &&
					deploymentServiceTypes.has(service.type)) ||
				(serviceKindFilter === "databases" &&
					databaseCredentialServiceTypes.has(service.type)) ||
				service.type === serviceKindFilter;

			const matchesStatus =
				serviceStatusFilter === "all" ||
				(service.status ?? "idle") === serviceStatusFilter;

			return matchesSearch && matchesKind && matchesStatus;
		});

		if (serviceSort === "manual") return nextServices;

		nextServices = [...nextServices].sort((a, b) => {
			switch (serviceSort) {
				case "name-asc":
					return a.name.localeCompare(b.name);
				case "type-asc":
					return serviceTypeLabels[a.type].localeCompare(
						serviceTypeLabels[b.type],
					);
				case "status-asc": {
					const statusRank = { error: 0, running: 1, done: 2, idle: 3 };
					return (
						statusRank[a.status ?? "idle"] - statusRank[b.status ?? "idle"] ||
						a.name.localeCompare(b.name)
					);
				}
				case "last-deploy-desc":
					return (
						new Date(b.lastDeployAt || 0).getTime() -
							new Date(a.lastDeployAt || 0).getTime() ||
						a.name.localeCompare(b.name)
					);
				default:
					return 0;
			}
		});

		return nextServices;
	}, [
		services,
		searchQuery,
		serviceKindFilter,
		serviceSort,
		serviceStatusFilter,
	]);

	const arrangedServices = useMemo(() => {
		if (serviceSort === "manual" && !hasCanvasFilters) return services;

		const filteredKeys = new Set(
			filteredServices.map((service) =>
				getWorkspaceServiceKey(service.type, service.id),
			),
		);

		return [
			...filteredServices,
			...services.filter(
				(service) =>
					!filteredKeys.has(getWorkspaceServiceKey(service.type, service.id)),
			),
		];
	}, [filteredServices, hasCanvasFilters, serviceSort, services]);

	const visibleServiceKeys = useMemo(
		() =>
			new Set(
				filteredServices.map((service) =>
					getWorkspaceServiceKey(service.type, service.id),
				),
			),
		[filteredServices],
	);

	const connections = workspace?.connections ?? [];
	const serviceLinkCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const connection of connections) {
			const sourceKey = getWorkspaceServiceKey(
				connection.sourceServiceType,
				connection.sourceServiceId,
			);
			const targetKey = getWorkspaceServiceKey(
				connection.targetServiceType,
				connection.targetServiceId,
			);
			counts.set(sourceKey, (counts.get(sourceKey) ?? 0) + 1);
			counts.set(targetKey, (counts.get(targetKey) ?? 0) + 1);
		}
		return counts;
	}, [connections]);
	const connectionGroups = useMemo(
		() => resolveWorkspaceConnectionGroups(nodes, connections),
		[nodes, connections],
	);
	const connectionGroupSummaries = useMemo(
		() =>
			connectionGroups.map((group, index) => {
				const groupServices = group.nodeKeys
					.map((nodeKey) => servicesByKey.get(nodeKey))
					.filter((service): service is WorkspaceService => Boolean(service));
				const groupNodeKeySet = new Set(group.nodeKeys);
				const runtimeServices = groupServices.filter((service) =>
					deploymentServiceTypes.has(service.type),
				);
				const dataServices = groupServices.filter((service) =>
					canWorkspaceServiceExposeVariables(service.type),
				);
				const leadRuntimeService = runtimeServices[0];
				const leadService = leadRuntimeService ?? groupServices[0];
				const title =
					leadRuntimeService && dataServices.length > 0
						? `${leadRuntimeService.name} stack`
						: groupServices.length <= 2
							? groupServices.map((service) => service.name).join(" + ")
							: `${leadService?.name ?? "Service"} group`;
				const connectionCount = connections.filter((connection) => {
					const sourceKey = getWorkspaceServiceKey(
						connection.sourceServiceType,
						connection.sourceServiceId,
					);
					const targetKey = getWorkspaceServiceKey(
						connection.targetServiceType,
						connection.targetServiceId,
					);
					return (
						groupNodeKeySet.has(sourceKey) && groupNodeKeySet.has(targetKey)
					);
				}).length;

				return {
					...group,
					index,
					title,
					connectionCount,
					serviceCount: groupServices.length,
					runtimeCount: runtimeServices.length,
					dataCount: dataServices.length,
					searchText: groupServices
						.map(
							(service) => `${service.name} ${serviceTypeLabels[service.type]}`,
						)
						.join(" "),
				};
			}),
		[connectionGroups, connections, servicesByKey],
	);
	const selectedConnections = selectedService
		? connections.filter(
				(connection) =>
					(connection.sourceServiceId === selectedService.serviceId &&
						connection.sourceServiceType === selectedService.serviceType) ||
					(connection.targetServiceId === selectedService.serviceId &&
						connection.targetServiceType === selectedService.serviceType),
			)
		: [];
	const selectedIncomingConnections = selectedService
		? connections.filter(
				(connection) =>
					connection.targetServiceId === selectedService.serviceId &&
					connection.targetServiceType === selectedService.serviceType,
			)
		: [];
	const connectSourceNode = connectSource
		? nodesByKey.get(
				getWorkspaceServiceKey(
					connectSource.serviceType,
					connectSource.serviceId,
				),
			)
		: undefined;
	const connectSourceService = connectSource
		? servicesByKey.get(
				getWorkspaceServiceKey(
					connectSource.serviceType,
					connectSource.serviceId,
				),
			)
		: undefined;
	const connectionPreview =
		connectSourceNode && connectionPointer
			? connectionPreviewPath(connectSourceNode, connectionPointer)
			: null;
	const projectVariableKeys = useMemo(
		() =>
			parseEnvironmentVariables(workspace?.environment.env)
				.map((entry) => entry.key)
				.sort((a, b) => a.localeCompare(b)),
		[workspace?.environment.env],
	);
	const workspaceStats = useMemo(
		() => countWorkspaceTopology(services, connections),
		[connections, services],
	);
	const unlinkedServices = useMemo(
		() =>
			filteredServices.filter(
				(service) =>
					(serviceLinkCounts.get(
						getWorkspaceServiceKey(service.type, service.id),
					) ?? 0) === 0,
			),
		[filteredServices, serviceLinkCounts],
	);

	const canvasBounds = useMemo(() => {
		const maxX = nodes.reduce(
			(max, node) => Math.max(max, node.x + node.width),
			0,
		);
		const maxY = nodes.reduce(
			(max, node) => Math.max(max, node.y + node.height),
			0,
		);
		return {
			width: Math.max(1280, maxX + 320),
			height: Math.max(720, maxY + 240),
		};
	}, [nodes]);

	const persistNode = useCallback(
		async (node: WorkspaceNode) => {
			await updateNode.mutateAsync({
				environmentId,
				serviceId: node.serviceId,
				serviceType: node.serviceType,
				x: Math.round(node.x),
				y: Math.round(node.y),
				width: node.width,
				height: node.height,
			});
			await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
		},
		[environmentId, updateNode, utils.workspaceGraph.byEnvironment],
	);

	const onNodePointerDown = (
		event: PointerEvent<HTMLButtonElement>,
		node: WorkspaceNode,
	) => {
		if (isSelectionMode) return;
		if (event.button !== 0) return;
		if ((event.target as HTMLElement).closest("[data-node-action]")) return;

		event.currentTarget.setPointerCapture(event.pointerId);
		dragState.current = {
			key: getWorkspaceServiceKey(node.serviceType, node.serviceId),
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: node.x,
			originY: node.y,
			moved: false,
		};
	};

	const onNodePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
		const drag = dragState.current;
		if (!drag) return;

		const deltaX = event.clientX - drag.startX;
		const deltaY = event.clientY - drag.startY;

		if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
			drag.moved = true;
			suppressClick.current = true;
		}

		setNodes((current) =>
			current.map((node) =>
				getWorkspaceServiceKey(node.serviceType, node.serviceId) === drag.key
					? {
							...node,
							x: Math.max(20, drag.originX + deltaX),
							y: Math.max(20, drag.originY + deltaY),
						}
					: node,
			),
		);
	};

	const onNodePointerUp = async (event: PointerEvent<HTMLButtonElement>) => {
		const drag = dragState.current;
		if (!drag) return;

		event.currentTarget.releasePointerCapture(drag.pointerId);
		dragState.current = null;

		if (!drag.moved) return;

		const node = nodes.find(
			(item) =>
				getWorkspaceServiceKey(item.serviceType, item.serviceId) === drag.key,
		);
		if (!node) return;

		// Guard this node from being clobbered by an in-flight refetch (e.g. a
		// concurrent drag's save) until our own save has settled and been reflected.
		pendingNodeKeys.current.add(drag.key);
		try {
			await persistNode(node);
		} catch (error) {
			logger.error("Could not save service position", error);
			toast.error(
				`Could not save service position: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			// Hold the guard briefly past the save so a refetch that started just
			// before the mutation resolved cannot snap the node back, then release it
			// so future server updates flow through normally.
			const settledKey = drag.key;
			setTimeout(() => {
				pendingNodeKeys.current.delete(settledKey);
			}, 750);
		}
	};

	const startConnectionFromService = (service: WorkspaceService) => {
		setConnectSource({
			serviceId: service.id,
			serviceType: service.type,
		});
		const node = nodesByKey.get(
			getWorkspaceServiceKey(service.type, service.id),
		);
		setConnectionPointer(node ? nodeCenter(node) : null);
		closeSelectedService();
		toast.info(
			"Select another service on the canvas. Database links auto-apply variables when possible.",
		);
	};

	const selectOrConnectService = async (service: WorkspaceService) => {
		if (suppressClick.current) {
			suppressClick.current = false;
			return;
		}

		const nextRef = { serviceId: service.id, serviceType: service.type };

		if (isSelectionMode) {
			toggleBulkService(service);
			return;
		}

		if (connectSource) {
			if (
				connectSource.serviceId === service.id &&
				connectSource.serviceType === service.type
			) {
				setConnectSource(null);
				setConnectionPointer(null);
				return;
			}

			try {
				const normalized = normalizeWorkspaceConnectionEndpoints(
					connectSource,
					nextRef,
				);
				const normalizedSource = servicesByKey.get(
					getWorkspaceServiceKey(
						normalized.source.serviceType,
						normalized.source.serviceId,
					),
				);
				const normalizedTarget = servicesByKey.get(
					getWorkspaceServiceKey(
						normalized.target.serviceType,
						normalized.target.serviceId,
					),
				);
				const canApplyVariables =
					canWorkspaceServiceExposeVariables(normalized.source.serviceType) &&
					!!permissions?.envVars.write;

				const result = await connect.mutateAsync({
					environmentId,
					source: normalized.source,
					target: normalized.target,
					label: canWorkspaceServiceExposeVariables(
						normalized.source.serviceType,
					)
						? "Private network + variables"
						: "Private network",
					applyVariables: canApplyVariables,
				});
				await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
				if (result.variablesApplied > 0) {
					await invalidateServiceEnvironment({
						serviceId: result.connection.targetServiceId,
						serviceType: result.connection.targetServiceType,
					});
				}
				const edgeLabel =
					normalizedSource && normalizedTarget
						? `${normalizedSource.name} -> ${normalizedTarget.name}`
						: "Services connected";
				toast.success(
					result.variablesApplied > 0
						? `${edgeLabel}; ${result.variablesApplied} variable${result.variablesApplied === 1 ? "" : "s"} applied`
						: edgeLabel,
				);
			} catch (error) {
				logger.error("Could not connect services", error);
				toast.error(
					`Could not connect services: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			} finally {
				setConnectSource(null);
				setConnectionPointer(null);
			}
			return;
		}

		setSelectedService(nextRef);
		setDrawerTab("overview");
	};

	const toggleSelectionMode = () => {
		setIsSelectionMode((current) => {
			const next = !current;
			if (next) {
				setConnectSource(null);
				setConnectionPointer(null);
				closeSelectedService();
			} else {
				setSelectedBulkKeys([]);
				setIsMoveDialogOpen(false);
				setIsBulkDeleteDialogOpen(false);
				setIsDuplicateDialogOpen(false);
			}
			return next;
		});
	};

	const toggleBulkService = (service: WorkspaceService) => {
		const serviceKey = getWorkspaceServiceKey(service.type, service.id);
		setSelectedBulkKeys((current) =>
			current.includes(serviceKey)
				? current.filter((key) => key !== serviceKey)
				: [...current, serviceKey],
		);
	};

	const selectVisibleServices = () => {
		const nextKeys = filteredServices.map((service) =>
			getWorkspaceServiceKey(service.type, service.id),
		);
		setSelectedBulkKeys((current) => [...new Set([...current, ...nextKeys])]);
	};

	const clearBulkSelection = () => {
		setSelectedBulkKeys([]);
	};

	const selectServiceGroup = (nodeKeys: string[]) => {
		const selectableKeys = nodeKeys.filter((nodeKey) =>
			servicesByKey.has(nodeKey),
		);
		if (selectableKeys.length === 0) return;

		setConnectSource(null);
		setConnectionPointer(null);
		setIsSelectionMode(true);
		setSelectedBulkKeys(selectableKeys);
		closeSelectedService();
	};

	const handleConnectionHandleClick = (service: WorkspaceService) => {
		if (connectSource) {
			void selectOrConnectService(service);
			return;
		}

		startConnectionFromService(service);
	};

	const updateConnectionPointer = (event: PointerEvent<HTMLDivElement>) => {
		if (!connectSource) return;

		const rect = event.currentTarget.getBoundingClientRect();
		setConnectionPointer({
			x: Math.max(0, event.clientX - rect.left),
			y: Math.max(0, event.clientY - rect.top),
		});
	};

	const resetCanvasFilters = () => {
		setSearchQuery("");
		setServiceKindFilter("all");
		setServiceStatusFilter("all");
	};

	const toggleTopologyPanel = () => {
		if (connectSource) {
			setConnectSource(null);
			setConnectionPointer(null);
			return;
		}

		setIsTopologyOpen((current) => !current);
	};

	const resetMoveDialog = () => {
		setIsMoveDialogOpen(false);
		setSelectedTargetProject("");
		setSelectedTargetEnvironment("");
	};

	const resetBulkDeleteDialog = () => {
		setIsBulkDeleteDialogOpen(false);
		setDeleteComposeVolumes(false);
	};

	const resetDuplicateDialog = () => {
		setIsDuplicateDialogOpen(false);
		setDuplicateMode("new-workspace");
		setDuplicateName("");
		setDuplicateDescription("");
		setDuplicateTargetProject("");
		setDuplicateTargetEnvironment("");
	};

	const openMoveDialog = () => {
		setSelectedTargetProject(workspaceId);
		setSelectedTargetEnvironment("");
		setIsMoveDialogOpen(true);
	};

	const runServiceAction = async (
		service: WorkspaceService,
		action: "start" | "stop" | "deploy",
	) => {
		const mutation = getServiceActions(service.type)[action];
		const actionInput = getActionInput(service);
		const actionPromise = (
			mutation.mutateAsync as (input: never) => Promise<unknown>
		)(actionInput as never);

		toast.promise(actionPromise, {
			loading:
				action === "deploy"
					? `Queuing ${service.name}...`
					: `${action === "start" ? "Starting" : "Stopping"} ${service.name}...`,
			success: async () => {
				await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
				return action === "deploy"
					? `${service.name} deployment queued`
					: `${service.name} ${action === "start" ? "started" : "stopped"}`;
			},
			error: (error) =>
				action === "deploy"
					? `Could not queue deployment for ${service.name}: ${error instanceof Error ? error.message : "Unknown error"}`
					: `Could not ${action} ${service.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	};

	const runBulkServiceAction = async (action: "start" | "stop" | "deploy") => {
		if (selectedBulkServices.length === 0) return;

		const servicesToRun = [...selectedBulkServices];
		let succeeded = 0;
		let failed = 0;
		setIsBulkActionLoading(true);

		try {
			for (const service of servicesToRun) {
				const mutation = getServiceActions(service.type)[action];
				const actionInput = getActionInput(service);

				try {
					await (mutation.mutateAsync as (input: never) => Promise<unknown>)(
						actionInput as never,
					);
					succeeded++;
				} catch (err) {
					logger.debug("bulk action item failed:", err);
					failed++;
				}
			}

			await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
			if (succeeded > 0) {
				const deploymentNoun = succeeded === 1 ? "deployment" : "deployments";
				toast.success(
					action === "deploy"
						? `${succeeded} service ${deploymentNoun} queued`
						: `${succeeded} services ${action === "start" ? "started" : "stopped"}`,
				);
			}
			if (failed > 0) {
				const deploymentNoun = failed === 1 ? "deployment" : "deployments";
				toast.error(
					action === "deploy"
						? `${failed} service ${deploymentNoun} could not be queued`
						: `${failed} services could not ${action}`,
				);
			}
			if (failed === 0) {
				setSelectedBulkKeys([]);
			}
		} finally {
			setIsBulkActionLoading(false);
		}
	};

	const runBulkMove = async () => {
		if (selectedBulkServices.length === 0) return;
		if (!selectedTargetProject) {
			toast.error("Select a target workspace");
			return;
		}
		if (!selectedTargetEnvironment) {
			toast.error("Select a target environment");
			return;
		}

		const servicesToMove = [...selectedBulkServices];
		let succeeded = 0;
		let failed = 0;
		setIsBulkActionLoading(true);

		try {
			for (const service of servicesToMove) {
				const mutation = getServiceActions(service.type).move;
				const actionInput = {
					...getActionInput(service),
					targetEnvironmentId: selectedTargetEnvironment,
				};

				try {
					await (mutation.mutateAsync as (input: never) => Promise<unknown>)(
						actionInput as never,
					);
					succeeded++;
				} catch (err) {
					logger.debug("bulk action item failed:", err);
					failed++;
				}
			}

			await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
			await utils.workspaces.all.invalidate();
			if (succeeded > 0) {
				toast.success(`${succeeded} services moved`);
			}
			if (failed > 0) {
				toast.error(`${failed} services could not move`);
			}
			if (failed === 0) {
				setSelectedBulkKeys([]);
				resetMoveDialog();
			}
		} finally {
			setIsBulkActionLoading(false);
		}
	};

	const runBulkDelete = async () => {
		if (selectedBulkServices.length === 0) return;
		if (selectedBulkRunningServices.length > 0) {
			toast.error("Stop running services before deleting them");
			return;
		}

		const servicesToDelete = [...selectedBulkServices];
		let succeeded = 0;
		let failed = 0;
		setIsBulkActionLoading(true);

		try {
			for (const service of servicesToDelete) {
				const mutation = getServiceActions(service.type).delete;
				const actionInput = getDeleteInput(service, deleteComposeVolumes);

				try {
					await (mutation.mutateAsync as (input: never) => Promise<unknown>)(
						actionInput as never,
					);
					succeeded++;
				} catch (err) {
					logger.debug("bulk action item failed:", err);
					failed++;
				}
			}

			await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
			await utils.workspaces.all.invalidate();
			if (succeeded > 0) {
				toast.success(`${succeeded} services deleted`);
			}
			if (failed > 0) {
				toast.error(`${failed} services could not be deleted`);
			}
			if (failed === 0) {
				setSelectedBulkKeys([]);
				resetBulkDeleteDialog();
			}
		} finally {
			setIsBulkActionLoading(false);
		}
	};

	const runBulkDuplicate = async () => {
		if (selectedBulkServices.length === 0) return;
		if (duplicateMode === "new-workspace" && !duplicateName.trim()) {
			toast.error("Workspace name is required");
			return;
		}
		if (
			duplicateMode === "existing-environment" &&
			!duplicateTargetEnvironment
		) {
			toast.error("Select a target environment");
			return;
		}

		const targetEnvironmentId =
			duplicateMode === "existing-environment"
				? duplicateTargetEnvironment
				: environmentId;

		try {
			const newEnvironment = await duplicateProject.mutateAsync({
				sourceEnvironmentId: targetEnvironmentId,
				name: duplicateName.trim(),
				description: duplicateDescription.trim() || undefined,
				includeServices: true,
				selectedServices: selectedBulkServices.map((service) => ({
					id: service.id,
					type: service.type,
				})),
				duplicateInSameProject: duplicateMode === "existing-environment",
			});

			await utils.workspaces.all.invalidate();
			if (
				duplicateMode === "existing-environment" &&
				duplicateTargetEnvironment === environmentId
			) {
				await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
			}
			toast.success(
				duplicateMode === "new-workspace"
					? "Services duplicated to a new workspace"
					: "Services duplicated",
			);
			resetDuplicateDialog();

			if (duplicateMode === "new-workspace" && newEnvironment?.workspaceId) {
				router.push(
					workspaceEnvironmentPath({
						workspaceId: newEnvironment.workspaceId,
						environmentId: newEnvironment.environmentId,
					}),
				);
			}
		} catch (error) {
			logger.error("Could not duplicate services", error);
			toast.error(
				`Could not duplicate services: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	const removeSelectedConnection = async (connection: WorkspaceConnection) => {
		await removeConnection.mutateAsync({
			connectionId: connection.connectionId,
		});
		await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
		toast.success("Connection removed");
	};

	const invalidateServiceEnvironment = async (service: SelectedServiceRef) => {
		switch (service.serviceType) {
			case "application":
				await utils.application.one.invalidate({
					applicationId: service.serviceId,
				});
				break;
			case "compose":
				await utils.compose.one.invalidate({ composeId: service.serviceId });
				break;
			default:
				await utils.database.one.invalidate({ databaseId: service.serviceId });
				break;
		}
	};

	const applyVariablesForConnection = async (
		connection: WorkspaceConnection,
	) => {
		toast.promise(
			applyConnectionVariables.mutateAsync({
				connectionId: connection.connectionId,
			}),
			{
				loading: "Applying variables...",
				success: async (result) => {
					await invalidateServiceEnvironment({
						serviceId: connection.targetServiceId,
						serviceType: connection.targetServiceType,
					});
					return `${result.entries.length} variable${result.entries.length === 1 ? "" : "s"} applied`;
				},
				error: (error) =>
					`Could not apply variables: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
		);
	};

	const syncVariablesForSelectedService = async () => {
		if (!selectedServiceModel) return;

		toast.promise(
			syncConnectionVariables.mutateAsync({
				environmentId,
				serviceId: selectedServiceModel.id,
				serviceType: selectedServiceModel.type,
			}),
			{
				loading: "Syncing linked variables...",
				success: async (result) => {
					await invalidateServiceEnvironment({
						serviceId: selectedServiceModel.id,
						serviceType: selectedServiceModel.type,
					});

					if (result.variablesApplied === 0) {
						return "No generated variables to sync";
					}

					return `${result.variablesApplied} variable${result.variablesApplied === 1 ? "" : "s"} synced from ${result.connectionsApplied} link${result.connectionsApplied === 1 ? "" : "s"}`;
				},
				error: (error) =>
					`Could not sync variables: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
		);
	};

	const closeSelectedService = () => {
		setSelectedService(null);

		if (!queryServiceId && !queryServiceType) return;

		const nextParams = new URLSearchParams(searchParams.toString());
		nextParams.delete("serviceId");
		nextParams.delete("serviceType");
		const query = nextParams.toString();
		router.replace(query ? `${pathname}?${query}` : pathname, {
			scroll: false,
		});
	};

	const openServiceFromTopology = (service: WorkspaceService) => {
		setConnectSource(null);
		setConnectionPointer(null);
		setIsSelectionMode(false);
		setSelectedBulkKeys([]);
		setSelectedService({
			serviceId: service.id,
			serviceType: service.type,
		});
		setDrawerTab("overview");

		const nextParams = new URLSearchParams(searchParams.toString());
		nextParams.set("serviceId", service.id);
		nextParams.set("serviceType", service.type);
		router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
	};

	const arrangeWorkspace = async () => {
		if (services.length === 0) return;

		const arrangedNodes = arrangedServices.map((service, index) => ({
			...getDefaultWorkspacePosition(index),
			serviceId: service.id,
			serviceType: service.type,
		}));
		setNodes(arrangedNodes);
		setIsArranging(true);

		toast.promise(
			Promise.all(
				arrangedNodes.map((node) =>
					updateNode.mutateAsync({
						environmentId,
						serviceId: node.serviceId,
						serviceType: node.serviceType,
						x: node.x,
						y: node.y,
						width: node.width,
						height: node.height,
					}),
				),
			).finally(() => setIsArranging(false)),
			{
				loading: "Arranging workspace...",
				success: async () => {
					await utils.workspaceGraph.byEnvironment.invalidate({
						environmentId,
					});
					return "Workspace arranged";
				},
				error: (error) =>
					`Could not arrange workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
		);
	};

	const duplicateCurrentEnvironment = async () => {
		if (!workspace) {
			toast.error("Workspace is still loading");
			return;
		}

		const now = new Date();
		const dateSlug = [
			now.getFullYear(),
			String(now.getMonth() + 1).padStart(2, "0"),
			String(now.getDate()).padStart(2, "0"),
			String(now.getHours()).padStart(2, "0"),
			String(now.getMinutes()).padStart(2, "0"),
		].join("");
		const sourceSlug =
			workspace.environment.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 28) || "environment";
		const environmentName = `preview-${sourceSlug}-${dateSlug}`;

		toast.promise(
			duplicateEnvironment.mutateAsync({
				environmentId,
				name: environmentName,
				description: `Preview copy of ${workspace.environment.name}`,
			}),
			{
				loading: "Creating preview environment...",
				success: async (result) => {
					await utils.workspaces.all.invalidate();
					await utils.environment.byWorkspaceId.invalidate({ workspaceId });
					router.push(
						workspaceEnvironmentPath({
							workspaceId: workspaceId,
							environmentId: result.environmentId,
						}),
					);
					return "Preview environment created";
				},
				error: (error) =>
					`Could not create preview environment: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
		);
	};

	const normalizedCommandQuery = commandQuery.trim().toLowerCase();
	const openCreateDialog = (dialog: CreateServiceDialog) => {
		setCommandOpen(false);
		setCommandQuery("");
		setCreateDialog(dialog);
	};
	const openDatabaseDialog = (databaseType?: CreateDatabaseType) => {
		setCreateDatabaseType(databaseType);
		openCreateDialog("database");
	};
	const currentEnvironmentName = workspace?.environment.name ?? "environment";
	const getCreateDialogProps = (dialog: CreateServiceDialog) => ({
		open: createDialog === dialog,
		onOpenChange: (open: boolean) => {
			setCreateDialog(open ? dialog : null);
			if (!open && dialog === "database") setCreateDatabaseType(undefined);
		},
		hideTrigger: true,
	});
	const commandItems: CommandItem[] = [
		...(permissions?.service.create
			? [
					{
						id: "create:application",
						group: "Create" as const,
						label: "New application",
						detail: "Create an app service from source or image",
						search:
							"new create application app service build git docker image builder",
						icon: <Folder className="size-5 text-kumo-subtle" />,
						run: () => openCreateDialog("application"),
					},
					{
						id: "create:database",
						group: "Create" as const,
						label: "New database",
						detail: "Provision Postgres, Redis, MySQL, and more",
						search:
							"new create database postgres redis mysql mariadb mongo libsql",
						icon: <Database className="size-5 text-kumo-subtle" />,
						run: () => openDatabaseDialog(),
					},
					...[
						{
							type: "postgres" as const,
							label: "PostgreSQL",
							detail: "Provision a Postgres database",
							search: "postgres postgresql database sql relational",
							icon: <PostgresqlIcon className="size-5" />,
						},
						{
							type: "redis" as const,
							label: "Redis",
							detail: "Provision a Redis datastore",
							search: "redis cache queue key value datastore",
							icon: <RedisIcon className="size-5" />,
						},
						{
							type: "mysql" as const,
							label: "MySQL",
							detail: "Provision a MySQL database",
							search: "mysql database sql relational",
							icon: <MysqlIcon className="size-5" />,
						},
						{
							type: "mariadb" as const,
							label: "MariaDB",
							detail: "Provision a MariaDB database",
							search: "mariadb mysql database sql relational",
							icon: <MariadbIcon className="size-5" />,
						},
						{
							type: "mongo" as const,
							label: "MongoDB",
							detail: "Provision a MongoDB database",
							search: "mongo mongodb database document",
							icon: <MongodbIcon className="size-5" />,
						},
						{
							type: "libsql" as const,
							label: "libSQL",
							detail: "Provision a libSQL database",
							search: "libsql sqlite turso database",
							icon: <LibsqlIcon className="size-5" />,
						},
					].map((database) => ({
						id: `create:database:${database.type}`,
						group: "Create" as const,
						label: database.label,
						detail: database.detail,
						search: `new create ${database.search}`,
						icon: database.icon,
						run: () => openDatabaseDialog(database.type),
					})),
					{
						id: "create:compose",
						group: "Create" as const,
						label: "New compose stack",
						detail: "Create a compose service group",
						search: "new create compose stack docker compose",
						icon: <CircuitBoard className="size-5 text-kumo-subtle" />,
						run: () => openCreateDialog("compose"),
					},
					{
						id: "create:template",
						group: "Create" as const,
						label: "Create from template",
						detail: "Browse templates and create a service",
						search: "new create build template catalog starter marketplace",
						icon: <PuzzleIcon className="size-5 text-kumo-subtle" />,
						run: () => openCreateDialog("template"),
					},
					{
						id: "create:import",
						group: "Create" as const,
						label: "Import compose",
						detail: "Import a base64 compose export",
						search: "new create import compose export base64 template",
						icon: <FileInput className="size-5 text-kumo-subtle" />,
						run: () => openCreateDialog("import"),
					},
				]
			: []),
		{
			id: "environment:preview-copy",
			group: "Environments" as const,
			label: "Create preview environment",
			detail: `Duplicate ${currentEnvironmentName} into a staging canvas`,
			search:
				"preview duplicate branch environment staging pull request pr temporary canvas",
			icon: <GitPullRequest className="size-5 text-kumo-subtle" />,
			run: () => {
				setCommandOpen(false);
				void duplicateCurrentEnvironment();
			},
		},
		...(workspaceEnvironments?.map((environment) => {
			const serviceCount =
				environment.applications.length +
				environment.compose.length +
				environment.database.length;

			return {
				id: `environment:${environment.environmentId}`,
				group: "Environments" as const,
				label: environment.name,
				detail:
					environment.environmentId === environmentId
						? "Current environment"
						: `${serviceCount} ${serviceCount === 1 ? "service" : "services"}`,
				search: `${environment.name} environment switch open ${environment.description ?? ""}`,
				icon: <GlobeIcon className="size-5 text-kumo-subtle" />,
				run: () => {
					setCommandOpen(false);
					setCommandQuery("");
					router.push(
						workspaceEnvironmentPath({
							workspaceId: workspaceId,
							environmentId: environment.environmentId,
						}),
					);
				},
			};
		}) ?? []),
		...services.flatMap((service) => {
			const baseSearch = [
				service.name,
				service.type,
				service.description,
				serviceTypeLabels[service.type],
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return [
				{
					id: `open:${service.type}:${service.id}`,
					group: "Services" as const,
					label: service.name,
					detail: `${serviceTypeLabels[service.type]} · open panel`,
					search: `${baseSearch} open panel overview`,
					icon: <WorkspaceServiceIcon service={service} />,
					run: () => {
						setSelectedService({
							serviceId: service.id,
							serviceType: service.type,
						});
						setDrawerTab("overview");
						setCommandOpen(false);
					},
				},
				{
					id: `deploy:${service.type}:${service.id}`,
					group: "Actions" as const,
					label: `Deploy ${service.name}`,
					detail: `${serviceTypeLabels[service.type]} · queue deployment`,
					search: `${baseSearch} deploy redeploy build release`,
					icon: <RefreshCw className="size-5 text-kumo-subtle" />,
					run: () => {
						setCommandOpen(false);
						void runServiceAction(service, "deploy");
					},
				},
				{
					id: `start:${service.type}:${service.id}`,
					group: "Actions" as const,
					label: `Start ${service.name}`,
					detail: `${serviceTypeLabels[service.type]} · start runtime`,
					search: `${baseSearch} start run up`,
					icon: <Play className="size-5 text-kumo-subtle" />,
					run: () => {
						setCommandOpen(false);
						void runServiceAction(service, "start");
					},
				},
				{
					id: `stop:${service.type}:${service.id}`,
					group: "Actions" as const,
					label: `Stop ${service.name}`,
					detail: `${serviceTypeLabels[service.type]} · stop runtime`,
					search: `${baseSearch} stop down pause`,
					icon: <X className="size-5 text-kumo-subtle" />,
					run: () => {
						setCommandOpen(false);
						void runServiceAction(service, "stop");
					},
				},
				{
					id: `variables:${service.type}:${service.id}`,
					group: "Actions" as const,
					label: `Variables for ${service.name}`,
					detail: `${serviceTypeLabels[service.type]} · edit env`,
					search: `${baseSearch} variables env secrets config`,
					icon: <SquareTerminal className="size-5 text-kumo-subtle" />,
					run: () => {
						setSelectedService({
							serviceId: service.id,
							serviceType: service.type,
						});
						setDrawerTab("variables");
						setCommandOpen(false);
					},
				},
				...(deploymentServiceTypes.has(service.type) &&
				permissions?.deployment.read
					? [
							{
								id: `deployments:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Deployment history for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · releases and worker output`,
								search: `${baseSearch} deployments releases history builds`,
								icon: <Rocket className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("deployments");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(deploymentServiceTypes.has(service.type) && permissions?.domain.read
					? [
							{
								id: `domains:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Domains for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · public ingress`,
								search: `${baseSearch} domains ingress urls routes tls ssl`,
								icon: <GlobeIcon className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("domains");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(service.type === "application" && permissions?.deployment.read
					? [
							{
								id: `previews:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Previews for ${service.name}`,
								detail: "Application · pull request environments",
								search: `${baseSearch} previews preview environments pull requests pr github`,
								icon: <GitPullRequest className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("previews");
									setCommandOpen(false);
								},
							},
						]
					: []),
				{
					id: `connections:${service.type}:${service.id}`,
					group: "Actions" as const,
					label: `Connections for ${service.name}`,
					detail: `${serviceTypeLabels[service.type]} · service graph`,
					search: `${baseSearch} connections links graph network variables`,
					icon: <Cable className="size-5 text-kumo-subtle" />,
					run: () => {
						setSelectedService({
							serviceId: service.id,
							serviceType: service.type,
						});
						setDrawerTab("connections");
						setCommandOpen(false);
					},
				},
				{
					id: `connect-from:${service.type}:${service.id}`,
					group: "Actions" as const,
					label: `Connect from ${service.name}`,
					detail: `${serviceTypeLabels[service.type]} · start drawing a private link`,
					search: `${baseSearch} connect link wire private network variables database`,
					icon: <Cable className="size-5 text-kumo-subtle" />,
					run: () => {
						setCommandOpen(false);
						startConnectionFromService(service);
					},
				},
				...(service.appName && permissions?.logs.read
					? [
							{
								id: `logs:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Logs for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · live runtime logs`,
								search: `${baseSearch} logs console runtime stdout stderr`,
								icon: <SquareTerminal className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("logs");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(service.appName && permissions?.service.read
					? [
							{
								id: `terminal:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Terminal for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · container shell`,
								search: `${baseSearch} terminal shell exec bash sh container console`,
								icon: <SquareTerminal className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("terminal");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(deploymentServiceTypes.has(service.type) &&
				permissions?.schedule.read
					? [
							{
								id: `schedules:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Automations for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · cron jobs and tasks`,
								search: `${baseSearch} schedules cron jobs tasks automation`,
								icon: <Clock className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("schedules");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(service.type === "compose" || getDatabaseBackupType(service)
					? [
							{
								id: `backups:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Backups for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · backup policies`,
								search: `${baseSearch} backups restore database snapshot s3`,
								icon: <Database className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("backups");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(hasDatabaseCredentials(service)
					? [
							{
								id: `credentials:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Credentials for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · connection strings`,
								search: `${baseSearch} credentials connection string password port external internal`,
								icon: <SquareTerminal className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("credentials");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(permissions?.service.create || permissions?.volume.read
					? [
							{
								id: `resources:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Resources for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · limits, ports, and storage`,
								search: `${baseSearch} resources storage volumes mounts ports cpu memory limits`,
								icon: <Box className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("resources");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(deploymentServiceTypes.has(service.type) &&
				permissions?.volumeBackup.read
					? [
							{
								id: `volume-backups:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Volume backups for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · persistent volume backups`,
								search: `${baseSearch} volume backups restore persistent storage`,
								icon: <Database className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("volume-backups");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(service.type === "compose" && permissions?.service.read
					? [
							{
								id: `containers:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Containers for ${service.name}`,
								detail: "Compose · inspect containers",
								search: `${baseSearch} containers docker tasks inspect terminal`,
								icon: <Box className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("containers");
									setCommandOpen(false);
								},
							},
						]
					: []),
				...(service.appName && permissions?.monitoring.read
					? [
							{
								id: `metrics:${service.type}:${service.id}`,
								group: "Actions" as const,
								label: `Metrics for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · live resource usage`,
								search: `${baseSearch} metrics monitoring cpu memory network disk`,
								icon: <RefreshCw className="size-5 text-kumo-subtle" />,
								run: () => {
									setSelectedService({
										serviceId: service.id,
										serviceType: service.type,
									});
									setDrawerTab("metrics");
									setCommandOpen(false);
								},
							},
						]
					: []),
				{
					id: `settings:${service.type}:${service.id}`,
					group: "Actions" as const,
					label: `Settings for ${service.name}`,
					detail: `${serviceTypeLabels[service.type]} · advanced settings`,
					search: `${baseSearch} settings full advanced configure`,
					icon: <Settings2 className="size-5 text-kumo-subtle" />,
					run: () => {
						setCommandOpen(false);
						router.push(
							getServiceSettingsHref(workspaceId, environmentId, service),
						);
					},
				},
			];
		}),
		...(services.length > 0
			? [
					{
						id: "workspace:arrange",
						group: "System" as const,
						label: "Arrange workspace",
						detail: "Reset service card layout",
						search: "arrange layout organize canvas workspace reset",
						icon: <Grip className="size-5 text-kumo-subtle" />,
						run: () => {
							setCommandOpen(false);
							void arrangeWorkspace();
						},
					},
					{
						id: "workspace:toggle-topology",
						group: "System" as const,
						label: isTopologyOpen ? "Hide topology" : "Show topology",
						detail: "Toggle connected stack and unlinked service panel",
						search: "topology graph groups sidebar panel connections links",
						icon: <Network className="size-5 text-kumo-subtle" />,
						run: () => {
							setCommandOpen(false);
							setIsTopologyOpen((current) => !current);
						},
					},
				]
			: []),
		...connectionGroupSummaries.map((group) => ({
			id: `group:${group.id}`,
			group: "Actions" as const,
			label: `Select ${group.title}`,
			detail: `${group.serviceCount} services · ${group.connectionCount} links`,
			search: `${group.title} ${group.searchText} service group stack connected graph select bulk`,
			icon: <CircuitBoard className="size-5 text-kumo-subtle" />,
			run: () => {
				setCommandOpen(false);
				selectServiceGroup(group.nodeKeys);
			},
		})),
		...[
			{
				id: "system:ingress",
				label: "Ingress",
				detail: "Domains, TLS, cleanup, and proxy",
				path: "/dashboard/settings/ingress",
				search: "ingress runtime domain tls ssl proxy cleanup",
				icon: <ServerIcon className="size-5 text-kumo-subtle" />,
			},
			{
				id: "system:remote-servers",
				label: "Runtime workers",
				detail: "Worker machines and placement",
				path: "/dashboard/settings/runtime",
				search: "remote servers runtime workers nodes machines",
				icon: <Network className="size-5 text-kumo-subtle" />,
			},
			{
				id: "system:git-providers",
				label: "Git providers",
				detail: "GitHub, GitLab, and Gitea",
				path: "/dashboard/settings/git-providers",
				search: "git providers github gitlab gitea oauth",
				icon: <FolderInput className="size-5 text-kumo-subtle" />,
			},
			{
				id: "system:registry",
				label: "Image registry",
				detail: "Container image registries",
				path: "/dashboard/settings/image-registry",
				search: "registry docker image container credentials",
				icon: <Box className="size-5 text-kumo-subtle" />,
			},
			{
				id: "system:ssh-keys",
				label: "SSH keys",
				detail: "Deploy keys and private keys",
				path: "/dashboard/settings/ssh-keys",
				search: "ssh keys private deploy git",
				icon: <SquareTerminal className="size-5 text-kumo-subtle" />,
			},
			{
				id: "system:notifications",
				label: "Notifications",
				detail: "Alerts and integrations",
				path: "/dashboard/settings/notifications",
				search: "notifications alerts discord slack webhook",
				icon: <Command className="size-5 text-kumo-subtle" />,
			},
		].map((item) => ({
			...item,
			group: "System" as const,
			run: () => {
				setCommandOpen(false);
				router.push(item.path);
			},
		})),
	];
	const filteredCommandItems = (
		normalizedCommandQuery
			? commandItems.filter((item) =>
					`${item.label} ${item.detail} ${item.search}`
						.toLowerCase()
						.includes(normalizedCommandQuery),
				)
			: commandItems.filter(
					(item) =>
						item.group !== "Actions" || item.id.startsWith("variables:"),
				)
	).slice(0, 48);
	const commandGroups: CommandGroup[] = [
		"Create",
		"Environments",
		"Services",
		"Actions",
		"System",
	];

	if (workspaceQuery.isPending) {
		return (
			<div className="flex min-h-[70vh] items-center justify-center gap-2 text-sm text-kumo-subtle">
				<Loader2 className="size-4 animate-spin" />
				<span>Loading workspace...</span>
			</div>
		);
	}

	// Distinguish a genuine load failure (auth loss / 500 / network) from a
	// real "not found". Without this an errored query silently rendered the
	// not-found copy, telling the user the workspace does not exist.
	if (workspaceQuery.isError) {
		return (
			<ErrorState
				className="min-h-[70vh]"
				title="Failed to load this environment"
				error={workspaceQuery.error}
				onRetry={() => workspaceQuery.refetch()}
			/>
		);
	}

	if (!workspace) {
		return (
			<div className="flex min-h-[70vh] items-center justify-center text-kumo-subtle">
				Workspace not found
			</div>
		);
	}

	return (
		<div className="h-[calc(100vh-5.5rem)] min-h-[720px] overflow-hidden">
			<AdvanceBreadcrumb />

			<div className="grid h-[calc(100%-2.25rem)] grid-rows-[auto_1fr] overflow-hidden rounded-lg border bg-kumo-canvas">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-md border bg-kumo-fill/40">
							<Network className="size-5 text-kumo-subtle" />
						</div>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="truncate text-lg font-semibold">
									{workspace.workspace.name}
								</h1>
								<AdvancedEnvironmentSelector
									workspaceId={workspaceId}
									currentEnvironmentId={environmentId}
								/>
							</div>
							<p className="truncate text-sm text-kumo-subtle">
								{workspace.environment.description ||
									`${workspace.environment.name} environment`}
							</p>
							<div className="mt-2 flex flex-wrap items-center gap-1.5">
								<Badge>{workspaceStats.services} services</Badge>
								<Badge>{workspaceStats.running} running</Badge>
								<Badge>{workspaceStats.errors} errors</Badge>
								<Badge>{workspaceStats.connections} links</Badge>
								{hasCanvasFilters && (
									<Badge>{filteredServices.length} visible</Badge>
								)}
							</div>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="relative">
							<FocusShortcutInput
								placeholder="Search services..."
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								className="h-9 w-[220px] pr-9"
							/>
							<Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-kumo-subtle" />
						</div>
						<div className="w-[150px]">
							<Select
								aria-label="Service type filter"
								value={serviceKindFilter}
								onValueChange={(value) =>
									value !== null &&
									setServiceKindFilter(value as ServiceKindFilter)
								}
							>
								{serviceKindFilterOptions.map((option) => (
									<Select.Option key={option.value} value={option.value}>
										{option.label}
									</Select.Option>
								))}
							</Select>
						</div>
						<div className="w-[140px]">
							<Select
								aria-label="Service status filter"
								value={serviceStatusFilter}
								onValueChange={(value) =>
									value !== null &&
									setServiceStatusFilter(value as ServiceStatusFilter)
								}
							>
								{serviceStatusFilterOptions.map((option) => (
									<Select.Option key={option.value} value={option.value}>
										{option.label}
									</Select.Option>
								))}
							</Select>
						</div>
						<div className="flex w-[170px] items-center gap-2">
							<ArrowUpDown className="size-4 shrink-0 text-kumo-subtle" />
							<Select
								aria-label="Service sort"
								value={serviceSort}
								onValueChange={(value) =>
									value !== null && setServiceSort(value as ServiceSort)
								}
							>
								{serviceSortOptions.map((option) => (
									<Select.Option key={option.value} value={option.value}>
										{option.label}
									</Select.Option>
								))}
							</Select>
						</div>
						{hasCanvasFilters && (
							<Button variant="outline" onClick={resetCanvasFilters}>
								<X className="size-4" />
								Reset {canvasFilterCount}
							</Button>
						)}

						<Button
							variant={connectSource || isTopologyOpen ? "primary" : "outline"}
							onClick={toggleTopologyPanel}
						>
							<Cable className="size-4" />
							{connectSource
								? "Cancel link"
								: isTopologyOpen
									? "Hide topology"
									: "Topology"}
						</Button>

						<Button
							variant={isSelectionMode ? "primary" : "outline"}
							onClick={toggleSelectionMode}
							disabled={services.length === 0}
						>
							<CheckCircle2 className="size-4" />
							{isSelectionMode
								? `Selecting${selectedBulkServices.length ? ` (${selectedBulkServices.length})` : ""}`
								: "Select"}
						</Button>

						<Button
							variant="outline"
							onClick={() => {
								setCommandQuery("");
								setCommandOpen(true);
							}}
						>
							<Command className="size-4" />
							Cmd K
						</Button>

						<Button
							variant="outline"
							onClick={arrangeWorkspace}
							loading={isArranging}
							disabled={services.length === 0}
						>
							<Grip className="size-4" />
							Arrange
						</Button>

						<DropdownMenu>
							<DropdownMenu.Trigger
								render={
									(
										<Button
											aria-label="System settings"
											variant="outline"
											shape="square"
										>
											<Settings2 className="size-4" />
										</Button>
									) as never
								}
							/>
							<DropdownMenu.Content className="w-[240px] space-y-1" align="end">
								<DropdownMenu.Group>
									<DropdownMenu.Label className="text-sm font-normal">
										System settings
									</DropdownMenu.Label>
								</DropdownMenu.Group>
								<DropdownMenu.Separator />
								<Link href="/dashboard/settings/ingress">
									<DropdownMenu.Item className="cursor-pointer">
										Ingress
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/runtime">
									<DropdownMenu.Item className="cursor-pointer">
										Runtime workers
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/git-providers">
									<DropdownMenu.Item className="cursor-pointer">
										Git providers
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/image-registry">
									<DropdownMenu.Item className="cursor-pointer">
										Image registry
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/ssh-keys">
									<DropdownMenu.Item className="cursor-pointer">
										SSH keys
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/notifications">
									<DropdownMenu.Item className="cursor-pointer">
										Notifications
									</DropdownMenu.Item>
								</Link>
							</DropdownMenu.Content>
						</DropdownMenu>

						<WorkspaceVariables workspaceId={workspaceId}>
							<Button variant="outline">
								<Box className="size-4" />
								Workspace vars
							</Button>
						</WorkspaceVariables>

						<EnvironmentVariables environmentId={environmentId}>
							<Button aria-label="Environment variables" variant="outline">
								<SquareTerminal className="size-4" />
								Env vars
							</Button>
						</EnvironmentVariables>

						{permissions?.service.create && (
							<DropdownMenu>
								<DropdownMenu.Trigger
									render={
										(
											<Button>
												<PlusIcon className="size-4" />
												New
											</Button>
										) as never
									}
								/>
								<DropdownMenu.Content
									className="w-[220px] space-y-1"
									align="end"
								>
									<DropdownMenu.Group>
										<DropdownMenu.Label className="text-sm font-normal">
											Add service
										</DropdownMenu.Label>
									</DropdownMenu.Group>
									<DropdownMenu.Separator />
									<AddApplication
										projectName={workspace.workspace.name}
										environmentId={environmentId}
									/>
									<AddDatabase
										projectName={workspace.workspace.name}
										environmentId={environmentId}
									/>
									<AddCompose
										projectName={workspace.workspace.name}
										environmentId={environmentId}
									/>
									<AddTemplate environmentId={environmentId} />
									<AddImport
										projectName={workspace.workspace.name}
										environmentId={environmentId}
									/>
								</DropdownMenu.Content>
							</DropdownMenu>
						)}
					</div>
					{isSelectionMode && (
						<div className="flex basis-full flex-wrap items-center justify-between gap-3 rounded-md border bg-kumo-fill/20 px-3 py-2 text-sm">
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<Badge>{selectedBulkServices.length} selected</Badge>
								<span className="text-kumo-subtle">
									Select services on the canvas, then run a bulk action.
								</span>
								{selectedBulkRunningServices.length > 0 && (
									<span className="text-kumo-danger">
										Stop running services before deleting.
									</span>
								)}
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant="outline"
									onClick={selectVisibleServices}
									disabled={filteredServices.length === 0}
								>
									Select visible
								</Button>
								<Button
									variant="outline"
									onClick={clearBulkSelection}
									disabled={selectedBulkServices.length === 0}
								>
									Clear
								</Button>
								<Button
									variant="outline"
									onClick={openMoveDialog}
									disabled={selectedBulkServices.length === 0}
								>
									<ArrowRight className="size-4" />
									Move
								</Button>
								<Button
									variant="outline"
									onClick={() => setIsDuplicateDialogOpen(true)}
									disabled={selectedBulkServices.length === 0}
								>
									<FolderInput className="size-4" />
									Duplicate
								</Button>
								{permissions?.service.delete && (
									<Button
										variant="outline"
										onClick={() => setIsBulkDeleteDialogOpen(true)}
										disabled={
											selectedBulkServices.length === 0 ||
											selectedBulkRunningServices.length > 0
										}
									>
										<Trash2 className="size-4" />
										Delete
									</Button>
								)}
								<Button
									variant="outline"
									onClick={() => void runBulkServiceAction("start")}
									loading={isBulkActionLoading}
									disabled={selectedBulkServices.length === 0}
								>
									<Play className="size-4" />
									Start
								</Button>
								<Button
									variant="outline"
									onClick={() => void runBulkServiceAction("stop")}
									loading={isBulkActionLoading}
									disabled={selectedBulkServices.length === 0}
								>
									<X className="size-4" />
									Stop
								</Button>
								<Button
									onClick={() => void runBulkServiceAction("deploy")}
									loading={isBulkActionLoading}
									disabled={selectedBulkServices.length === 0}
								>
									<RefreshCw className="size-4" />
									Deploy
								</Button>
							</div>
						</div>
					)}
				</div>

				<div
					className={cn(
						"grid min-h-0 grid-cols-1 bg-kumo-fill/20",
						isTopologyOpen && "lg:grid-cols-[280px_minmax(0,1fr)]",
					)}
				>
					{isTopologyOpen && (
						<aside className="max-h-64 overflow-auto border-b bg-kumo-canvas/80 p-3 lg:max-h-none lg:border-b-0 lg:border-r">
							<div className="mb-3 flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="text-sm font-medium">Topology</p>
									<p className="text-xs text-kumo-subtle">
										{connectionGroupSummaries.length > 0
											? `${connectionGroupSummaries.length} connected stack${connectionGroupSummaries.length === 1 ? "" : "s"}`
											: "No linked services yet"}
									</p>
								</div>
								<Badge>{unlinkedServices.length} unlinked</Badge>
							</div>

							<div className="space-y-4">
								{connectionGroupSummaries.length > 0 && (
									<div className="space-y-2">
										<p className="text-xs uppercase text-kumo-subtle">Stacks</p>
										<div className="space-y-1.5">
											{connectionGroupSummaries.map((group) => {
												const groupSelected = group.nodeKeys.every((nodeKey) =>
													selectedBulkKeySet.has(nodeKey),
												);
												const groupVisible = group.nodeKeys.some((nodeKey) =>
													visibleServiceKeys.has(nodeKey),
												);

												return (
													<button
														key={group.id}
														type="button"
														aria-label={`Select ${group.title} topology group`}
														className={cn(
															"w-full rounded-md border bg-kumo-canvas p-2 text-left transition hover:bg-kumo-fill/40",
															groupSelected &&
																"border-kumo-brand bg-kumo-brand/5",
															!groupVisible && "opacity-50",
														)}
														onClick={() => selectServiceGroup(group.nodeKeys)}
													>
														<div className="flex items-center justify-between gap-2">
															<span className="truncate text-sm font-medium">
																{group.title ||
																	`Service group ${group.index + 1}`}
															</span>
															<Badge>{group.connectionCount} links</Badge>
														</div>
														<div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-kumo-subtle">
															<span>{group.serviceCount} services</span>
															{group.runtimeCount > 0 && (
																<span>{group.runtimeCount} runtimes</span>
															)}
															{group.dataCount > 0 && (
																<span>{group.dataCount} data stores</span>
															)}
														</div>
													</button>
												);
											})}
										</div>
									</div>
								)}

								<div className="space-y-2">
									<p className="text-xs uppercase text-kumo-subtle">Unlinked</p>
									{unlinkedServices.length === 0 ? (
										<p className="rounded-md border border-dashed bg-kumo-canvas/70 p-3 text-xs text-kumo-subtle">
											All visible services have at least one private link.
										</p>
									) : (
										<div className="space-y-1.5">
											{unlinkedServices.slice(0, 8).map((service) => (
												<button
													key={getWorkspaceServiceKey(service.type, service.id)}
													type="button"
													className="flex w-full items-center gap-2 rounded-md border bg-kumo-canvas p-2 text-left transition hover:bg-kumo-fill/40"
													onClick={() => openServiceFromTopology(service)}
												>
													<div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/30">
														<WorkspaceServiceIcon service={service} />
													</div>
													<div className="min-w-0">
														<p className="truncate text-sm font-medium">
															{service.name}
														</p>
														<p className="truncate text-xs text-kumo-subtle">
															{serviceTypeLabels[service.type]}
														</p>
													</div>
												</button>
											))}
											{unlinkedServices.length > 8 && (
												<p className="px-1 text-xs text-kumo-subtle">
													+{unlinkedServices.length - 8} more hidden by this
													panel
												</p>
											)}
										</div>
									)}
								</div>
							</div>
						</aside>
					)}
					<div className="relative min-w-0 overflow-auto">
						<div
							className="relative"
							onPointerMove={updateConnectionPointer}
							onPointerLeave={() => connectSource && setConnectionPointer(null)}
							style={{
								width: canvasBounds.width,
								height: canvasBounds.height,
								backgroundImage:
									"linear-gradient(to right, color-mix(in oklab, var(--color-kumo-hairline) 45%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-kumo-hairline) 45%, transparent) 1px, transparent 1px)",
								backgroundSize: "32px 32px",
							}}
						>
							{connectionGroupSummaries.map((group) => {
								const groupSelected = group.nodeKeys.every((nodeKey) =>
									selectedBulkKeySet.has(nodeKey),
								);

								return (
									<div
										key={group.id}
										className={cn(
											"pointer-events-none absolute rounded-xl border border-dashed bg-kumo-canvas/35",
											groupSelected
												? "border-kumo-brand/80 bg-kumo-brand/5"
												: "border-kumo-line",
										)}
										style={{
											left: group.x,
											top: group.y,
											width: group.width,
											height: group.height,
										}}
									>
										<div className="pointer-events-auto absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md border bg-kumo-canvas/90 px-2 py-1 text-xs text-kumo-subtle shadow-sm backdrop-blur">
											<div className="min-w-0">
												<p className="truncate font-medium text-kumo-default">
													{group.title || `Service group ${group.index + 1}`}
												</p>
												<div className="flex flex-wrap gap-x-2 gap-y-0.5">
													<span>{group.serviceCount} services</span>
													<span>{group.connectionCount} links</span>
													{group.runtimeCount > 0 && (
														<span>{group.runtimeCount} runtimes</span>
													)}
													{group.dataCount > 0 && (
														<span>{group.dataCount} data stores</span>
													)}
												</div>
											</div>
											<button
												type="button"
												className="shrink-0 rounded border px-2 py-1 font-medium text-kumo-default transition hover:bg-kumo-fill"
												onClick={() => selectServiceGroup(group.nodeKeys)}
											>
												{groupSelected ? "Selected" : "Select group"}
											</button>
										</div>
									</div>
								);
							})}

							<svg
								className="pointer-events-none absolute inset-0"
								width={canvasBounds.width}
								height={canvasBounds.height}
								aria-hidden="true"
							>
								<defs>
									<marker
										id="workspace-arrow"
										viewBox="0 0 10 10"
										refX="8"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path
											d="M 0 0 L 10 5 L 0 10 z"
											className="fill-kumo-subtle"
										/>
									</marker>
									<marker
										id="workspace-preview-dot"
										viewBox="0 0 10 10"
										refX="5"
										refY="5"
										markerWidth="5"
										markerHeight="5"
									>
										<circle cx="5" cy="5" r="4" className="fill-kumo-brand" />
									</marker>
								</defs>
								{connections.map((connection) => {
									const source = nodesByKey.get(
										getWorkspaceServiceKey(
											connection.sourceServiceType,
											connection.sourceServiceId,
										),
									);
									const target = nodesByKey.get(
										getWorkspaceServiceKey(
											connection.targetServiceType,
											connection.targetServiceId,
										),
									);
									if (!source || !target) return null;

									const sourceVisible = visibleServiceKeys.has(
										getWorkspaceServiceKey(
											connection.sourceServiceType,
											connection.sourceServiceId,
										),
									);
									const targetVisible = visibleServiceKeys.has(
										getWorkspaceServiceKey(
											connection.targetServiceType,
											connection.targetServiceId,
										),
									);

									return (
										<path
											key={connection.connectionId}
											d={connectionPath(source, target)}
											className={cn(
												"fill-none stroke-kumo-subtle/60 stroke-2",
												(!sourceVisible || !targetVisible) && "opacity-20",
											)}
											markerEnd="url(#workspace-arrow)"
										/>
									);
								})}
								{connectionPreview && (
									<path
										d={connectionPreview}
										className="fill-none stroke-kumo-brand stroke-2 opacity-80"
										strokeDasharray="8 8"
										markerEnd="url(#workspace-preview-dot)"
									/>
								)}
							</svg>

							{connectSourceService && (
								<div className="pointer-events-none absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-kumo-canvas/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
									<Cable className="size-4 text-kumo-brand" />
									<span>
										Connecting from{" "}
										<strong className="font-medium">
											{connectSourceService.name}
										</strong>
									</span>
									<span className="text-kumo-subtle">
										Select a target service
									</span>
								</div>
							)}

							{services.length === 0 ? (
								<div className="absolute left-1/2 top-1/2 flex w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-lg border bg-kumo-canvas/95 p-5 text-center shadow-sm backdrop-blur">
									<div className="flex size-12 items-center justify-center rounded-md border bg-kumo-fill/30">
										<FolderInput className="size-6 text-kumo-subtle" />
									</div>
									<div className="space-y-1">
										<p className="font-medium">Empty canvas</p>
										<p className="text-sm text-kumo-subtle">
											Start with a runtime, database, compose stack, or
											template.
										</p>
									</div>
									{permissions?.service.create && (
										<div className="flex flex-wrap justify-center gap-2">
											<Button onClick={() => openCreateDialog("application")}>
												<Folder className="size-4" />
												New app
											</Button>
											<Button
												variant="outline"
												onClick={() => openDatabaseDialog("postgres")}
											>
												<PostgresqlIcon className="size-4" />
												Postgres
											</Button>
											<Button
												variant="outline"
												onClick={() => openCreateDialog("compose")}
											>
												<CircuitBoard className="size-4" />
												Compose
											</Button>
											<Button
												variant="outline"
												onClick={() => openCreateDialog("template")}
											>
												<PuzzleIcon className="size-4" />
												Template
											</Button>
										</div>
									)}
								</div>
							) : null}

							{nodes.map((node) => {
								const serviceKey = getWorkspaceServiceKey(
									node.serviceType,
									node.serviceId,
								);
								const service = servicesByKey.get(serviceKey);
								if (!service) return null;

								const visible = visibleServiceKeys.has(serviceKey);
								const isConnectSource =
									connectSource?.serviceId === service.id &&
									connectSource.serviceType === service.type;
								const isBulkSelected = selectedBulkKeySet.has(serviceKey);
								const linkCount = serviceLinkCounts.get(serviceKey) ?? 0;

								return (
									<div
										key={serviceKey}
										className={cn(
											"group absolute rounded-lg transition",
											!visible && "pointer-events-none opacity-20",
										)}
										style={{
											left: node.x,
											top: node.y,
											width: node.width,
											height: node.height,
										}}
									>
										<button
											type="button"
											onPointerDown={(event) => onNodePointerDown(event, node)}
											onPointerMove={onNodePointerMove}
											onPointerUp={onNodePointerUp}
											onClick={() => selectOrConnectService(service)}
											className={cn(
												"h-full w-full touch-none rounded-lg text-left outline-none transition",
												isSelectionMode
													? "cursor-pointer"
													: "cursor-grab active:cursor-grabbing",
												"focus-visible:ring-2 focus-visible:ring-kumo-focus",
											)}
										>
											<LayerCard
												className={cn(
													"relative h-full bg-kumo-canvas/95 shadow-sm transition hover:bg-kumo-canvas",
													isConnectSource && "ring-2 ring-kumo-brand",
													connectSource &&
														!isConnectSource &&
														"ring-1 ring-kumo-brand/30",
													isBulkSelected && "ring-2 ring-kumo-brand",
												)}
											>
												<div className="flex h-full flex-col gap-4">
													<div className="flex items-start justify-between gap-4">
														<div className="flex min-w-0 items-start gap-3">
															<div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/40">
																<WorkspaceServiceIcon service={service} />
															</div>
															<div className="min-w-0">
																<div className="flex items-center gap-2">
																	<span className="truncate font-medium">
																		{service.name}
																	</span>
																	<Grip className="size-3 shrink-0 text-kumo-subtle" />
																</div>
																<p className="truncate text-xs text-kumo-subtle">
																	{serviceTypeLabels[service.type]}
																</p>
															</div>
														</div>
														<div className="flex shrink-0 items-center gap-1.5">
															{isSelectionMode && (
																<Badge>
																	{isBulkSelected ? "Selected" : "Select"}
																</Badge>
															)}
															<StatusTooltip
																status={service.status ?? undefined}
															/>
														</div>
													</div>

													<p className="line-clamp-2 min-h-[2.5rem] text-sm text-kumo-subtle">
														{service.description ||
															serviceTypeDescriptions[service.type]}
													</p>

													<div className="mt-auto space-y-1 text-xs text-kumo-subtle">
														<div className="flex items-center justify-between gap-3">
															<span className="flex min-w-0 items-center gap-1.5">
																<Network className="size-3 shrink-0" />
																<span className="truncate">
																	Private runtime
																</span>
															</span>
															<span>{linkCount} links</span>
														</div>
														<div className="flex min-w-0 items-center gap-1.5">
															<RefreshCw className="size-3 shrink-0" />
															<span className="truncate">
																{service.lastDeployAt
																	? `Deployed ${formatLastDeployment(service.lastDeployAt)}`
																	: "No deployments yet"}
															</span>
														</div>
													</div>
												</div>
												<ServiceRuntimePulse
													service={service}
													linkCount={linkCount}
												/>
											</LayerCard>
										</button>
										{!isSelectionMode && (
											<button
												type="button"
												aria-label={
													isConnectSource
														? `Cancel connection from ${service.name}`
														: connectSource
															? `Connect to ${service.name}`
															: `Start connection from ${service.name}`
												}
												className={cn(
													"absolute -right-4 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-kumo-canvas text-kumo-subtle opacity-0 shadow-sm transition hover:text-kumo-default group-hover:opacity-100",
													connectSource && "opacity-100",
													isConnectSource &&
														"border-kumo-brand text-kumo-brand",
												)}
												onClick={(event) => {
													event.stopPropagation();
													handleConnectionHandleClick(service);
												}}
											>
												{isConnectSource ? (
													<X className="size-4" />
												) : (
													<Cable className="size-4" />
												)}
											</button>
										)}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>

			{selectedServiceModel && (
				<aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-xl flex-col border-l bg-kumo-canvas shadow-xl">
					<div className="flex items-start justify-between gap-4 border-b p-5">
						<div className="flex min-w-0 gap-3">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/40">
								<WorkspaceServiceIcon service={selectedServiceModel} />
							</div>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<h2 className="truncate text-lg font-semibold">
										{selectedServiceModel.name}
									</h2>
									<StatusTooltip
										status={selectedServiceModel.status ?? undefined}
									/>
								</div>
								<p className="text-sm text-kumo-subtle">
									{serviceTypeLabels[selectedServiceModel.type]}
								</p>
							</div>
						</div>
						<Button
							aria-label="Close service panel"
							variant="ghost"
							shape="square"
							onClick={closeSelectedService}
						>
							<X className="size-4" />
						</Button>
					</div>

					<div className="border-b px-5 py-3">
						<Tabs
							value={activeDrawerTab}
							onValueChange={(value) =>
								value !== null && setDrawerTab(value as typeof drawerTab)
							}
							tabs={drawerTabs}
						/>
					</div>

					<div className="min-h-0 flex-1 overflow-auto p-5">
						<ErrorBoundary resetKey={activeDrawerTab} name="service-drawer-tab">
							{activeDrawerTab === "overview" && (
								<div className="space-y-5">
									<div className="grid grid-cols-2 gap-3">
										<Button
											variant="outline"
											onClick={() =>
												runServiceAction(selectedServiceModel, "start")
											}
										>
											<Play className="size-4" />
											Start
										</Button>
										<Button
											variant="outline"
											onClick={() =>
												runServiceAction(selectedServiceModel, "stop")
											}
										>
											<X className="size-4" />
											Stop
										</Button>
										<Button
											className="col-span-2"
											onClick={() =>
												runServiceAction(selectedServiceModel, "deploy")
											}
										>
											<RefreshCw className="size-4" />
											Deploy
										</Button>
									</div>

									<LayerCard className="bg-kumo-fill/20">
										<div className="space-y-3">
											<div className="flex items-center justify-between">
												<span className="text-sm font-medium">Runtime</span>
												<Badge>{selectedServiceModel.status || "idle"}</Badge>
											</div>
											<div className="grid gap-2 text-sm text-kumo-subtle">
												<div className="flex items-center justify-between gap-4">
													<span>Network</span>
													<span className="truncate">Private runtime</span>
												</div>
												<div className="flex items-center justify-between gap-4">
													<span>Type</span>
													<span>
														{serviceTypeLabels[selectedServiceModel.type]}
													</span>
												</div>
												<div className="flex items-center justify-between gap-4">
													<span>Last deployment</span>
													<span className="truncate">
														{formatLastDeployment(
															selectedServiceModel.lastDeployAt,
														)}
													</span>
												</div>
											</div>
										</div>
									</LayerCard>

									<div className="flex flex-wrap gap-2">
										<Button
											variant="outline"
											onClick={() =>
												startConnectionFromService(selectedServiceModel)
											}
										>
											<Cable className="size-4" />
											Connect
										</Button>
										<Link
											href={getServiceSettingsHref(
												workspaceId,
												environmentId,
												selectedServiceModel,
											)}
										>
											<Button variant="outline">
												<ExternalLink className="size-4" />
												Full settings
											</Button>
										</Link>
										{selectedServiceModel.appName &&
											permissions?.service.read && (
												<ServiceTerminalButton service={selectedServiceModel} />
											)}
										<DeleteService
											id={selectedServiceModel.id}
											type={selectedServiceModel.type}
										/>
									</div>
								</div>
							)}

							{activeDrawerTab === "variables" && (
								<div className="space-y-3">
									<LayerCard className="bg-kumo-fill/20">
										<div className="space-y-4">
											<div>
												<p className="text-sm font-medium">Variable graph</p>
												<p className="text-xs text-kumo-subtle">
													Workspace variables are inherited with{" "}
													<code>{"{{workspace.KEY}}"}</code>. Incoming service
													links can sync generated connection variables into
													this service.
												</p>
											</div>

											<div className="grid gap-3">
												<div className="rounded-md border bg-kumo-canvas/60 p-3">
													<div className="flex items-center justify-between gap-3">
														<span className="text-sm font-medium">
															Workspace scope
														</span>
														<Badge>
															{permissions?.envVars.read
																? `${projectVariableKeys.length} ${projectVariableKeys.length === 1 ? "key" : "keys"}`
																: "Restricted"}
														</Badge>
													</div>
													{permissions?.envVars.read &&
														(projectVariableKeys.length > 0 ? (
															<div className="mt-3 flex flex-wrap gap-1.5">
																{projectVariableKeys.map((key) => (
																	<Badge key={key}>{key}</Badge>
																))}
															</div>
														) : (
															<p className="mt-3 text-xs text-kumo-subtle">
																No workspace variables defined.
															</p>
														))}
													{!permissions?.envVars.read && (
														<p className="mt-3 text-xs text-kumo-subtle">
															You need variable read access to see inherited
															keys.
														</p>
													)}
												</div>

												<div className="rounded-md border bg-kumo-canvas/60 p-3">
													<div className="flex items-center justify-between gap-3">
														<span className="text-sm font-medium">
															Incoming links
														</span>
														<Badge>
															{selectedIncomingConnections.length}{" "}
															{selectedIncomingConnections.length === 1
																? "source"
																: "sources"}
														</Badge>
													</div>
													{selectedIncomingConnections.length === 0 ? (
														<p className="mt-3 text-xs text-kumo-subtle">
															No linked services are generating variables for
															this service.
														</p>
													) : (
														<div className="mt-3 space-y-3">
															{selectedIncomingConnections.map((connection) => {
																const source = servicesByKey.get(
																	getWorkspaceServiceKey(
																		connection.sourceServiceType,
																		connection.sourceServiceId,
																	),
																);

																return (
																	<ConnectionVariableFlowCard
																		key={connection.connectionId}
																		connection={connection}
																		source={source}
																		target={selectedServiceModel}
																		variablePreviewEnabled={
																			!!permissions?.envVars.read
																		}
																	/>
																);
															})}
														</div>
													)}
												</div>
											</div>
										</div>
									</LayerCard>
									{selectedServiceModel.type === "application" ? (
										<ShowApplicationEnvironment
											applicationId={selectedServiceModel.id}
										/>
									) : (
										<ShowServiceEnvironment
											id={selectedServiceModel.id}
											type={selectedServiceModel.type}
										/>
									)}
								</div>
							)}

							{activeDrawerTab === "deployments" &&
								(selectedServiceModel.type === "application" ||
									selectedServiceModel.type === "compose") && (
									<ShowDeployments
										id={selectedServiceModel.id}
										type={selectedServiceModel.type}
										runtimeWorkerId={selectedServiceModel.runtimeWorkerId || ""}
										refreshToken={selectedServiceModel.refreshToken || ""}
									/>
								)}

							{activeDrawerTab === "domains" &&
								(selectedServiceModel.type === "application" ||
									selectedServiceModel.type === "compose") && (
									<ShowDomains
										id={selectedServiceModel.id}
										type={selectedServiceModel.type}
									/>
								)}

							{activeDrawerTab === "previews" &&
								selectedServiceModel.type === "application" && (
									<ShowPreviewDeployments
										applicationId={selectedServiceModel.id}
									/>
								)}

							{activeDrawerTab === "schedules" &&
								(selectedServiceModel.type === "application" ||
									selectedServiceModel.type === "compose") && (
									<ShowSchedules
										id={selectedServiceModel.id}
										scheduleType={selectedServiceModel.type}
									/>
								)}

							{activeDrawerTab === "backups" && (
								<>
									{selectedServiceModel.type === "compose" ? (
										<ShowBackups
											id={selectedServiceModel.id}
											backupType="compose"
										/>
									) : (
										getDatabaseBackupType(selectedServiceModel) && (
											<ShowBackups
												id={selectedServiceModel.id}
												databaseType={getDatabaseBackupType(
													selectedServiceModel,
												)}
												backupType="database"
											/>
										)
									)}
								</>
							)}

							{activeDrawerTab === "credentials" &&
								hasDatabaseCredentials(selectedServiceModel) && (
									<DatabaseCredentials service={selectedServiceModel} />
								)}

							{activeDrawerTab === "resources" && (
								<div className="space-y-4">
									{selectedServiceModel.type !== "compose" &&
										permissions?.service.create && (
											<ShowResources
												id={selectedServiceModel.id}
												type={selectedServiceModel.type}
											/>
										)}
									<ShowVolumes
										id={selectedServiceModel.id}
										type={selectedServiceModel.type}
									/>
									{selectedServiceModel.type === "application" &&
										permissions?.service.create && (
											<ShowPorts applicationId={selectedServiceModel.id} />
										)}
								</div>
							)}

							{activeDrawerTab === "volume-backups" &&
								(selectedServiceModel.type === "application" ||
									selectedServiceModel.type === "compose") && (
									<ShowVolumeBackups
										id={selectedServiceModel.id}
										type={selectedServiceModel.type}
										runtimeWorkerId={selectedServiceModel.runtimeWorkerId || ""}
									/>
								)}

							{activeDrawerTab === "logs" && selectedServiceModel.appName && (
								<div className="space-y-3">
									{selectedServiceModel.type === "compose" ? (
										selectedServiceModel.composeType === "stack" ? (
											<ShowDockerLogsStack
												runtimeWorkerId={
													selectedServiceModel.runtimeWorkerId || ""
												}
												appName={selectedServiceModel.appName}
											/>
										) : (
											<ShowDockerLogsCompose
												runtimeWorkerId={
													selectedServiceModel.runtimeWorkerId || ""
												}
												appName={selectedServiceModel.appName}
												appType={
													selectedServiceModel.composeType || "docker-compose"
												}
											/>
										)
									) : (
										<ShowDockerLogs
											runtimeWorkerId={
												selectedServiceModel.runtimeWorkerId || ""
											}
											appName={selectedServiceModel.appName}
										/>
									)}
								</div>
							)}

							{activeDrawerTab === "terminal" &&
								selectedServiceModel.appName && (
									<LayerCard className="bg-kumo-fill/20">
										<div className="flex items-center justify-between gap-4">
											<div className="min-w-0">
												<h3 className="font-medium">Container Terminal</h3>
												<p className="truncate text-sm text-kumo-subtle">
													{selectedServiceModel.appName}
												</p>
											</div>
											<ServiceTerminalButton service={selectedServiceModel} />
										</div>
									</LayerCard>
								)}

							{activeDrawerTab === "containers" &&
								selectedServiceModel.type === "compose" &&
								selectedServiceModel.appName && (
									<ShowComposeContainers
										runtimeWorkerId={selectedServiceModel.runtimeWorkerId || ""}
										appName={selectedServiceModel.appName}
										appType={
											selectedServiceModel.composeType || "docker-compose"
										}
									/>
								)}

							{activeDrawerTab === "metrics" &&
								selectedServiceModel.appName && (
									<div className="space-y-3">
										{selectedServiceModel.type === "compose" ? (
											<ComposeMonitoring
												runtimeWorkerId={
													selectedServiceModel.runtimeWorkerId || ""
												}
												appName={selectedServiceModel.appName}
												appType={
													selectedServiceModel.composeType || "docker-compose"
												}
											/>
										) : (
											<ContainerMonitoring
												appName={selectedServiceModel.appName}
											/>
										)}
									</div>
								)}

							{activeDrawerTab === "connections" && (
								<div className="space-y-3">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="text-sm font-medium">Service graph</p>
											<p className="text-xs text-kumo-subtle">
												Incoming database links can sync generated variables
												into this service.
											</p>
										</div>
										<Button
											variant="outline"
											loading={syncConnectionVariables.isPending}
											disabled={
												!permissions?.envVars.write ||
												selectedIncomingConnections.length === 0
											}
											onClick={() => void syncVariablesForSelectedService()}
										>
											<RefreshCw className="size-4" />
											Sync vars
										</Button>
									</div>
									{selectedConnections.length === 0 ? (
										<div className="rounded-lg border border-dashed p-6 text-center text-sm text-kumo-subtle">
											No connections yet. Use Connect, then select another
											service on the canvas.
										</div>
									) : (
										selectedConnections.map((connection) => {
											const source = servicesByKey.get(
												getWorkspaceServiceKey(
													connection.sourceServiceType,
													connection.sourceServiceId,
												),
											);
											const target = servicesByKey.get(
												getWorkspaceServiceKey(
													connection.targetServiceType,
													connection.targetServiceId,
												),
											);

											return (
												<ConnectionVariableFlowCard
													key={connection.connectionId}
													connection={connection}
													source={source}
													target={target}
													variablePreviewEnabled={!!permissions?.envVars.read}
													actions={
														<>
															<Button
																variant="outline"
																disabled={!permissions?.envVars.write}
																onClick={() =>
																	applyVariablesForConnection(connection)
																}
															>
																<SquareTerminal className="size-4" />
																Apply vars
															</Button>
															<Button
																aria-label="Remove connection"
																variant="ghost"
																shape="square"
																onClick={() =>
																	removeSelectedConnection(connection)
																}
															>
																<Trash2 className="size-4" />
															</Button>
														</>
													}
												/>
											);
										})
									)}
								</div>
							)}
						</ErrorBoundary>
					</div>
				</aside>
			)}

			<MoveServicesDialog
				open={isMoveDialogOpen}
				onOpenChange={(open) => {
					if (open) {
						setIsMoveDialogOpen(true);
						return;
					}
					resetMoveDialog();
				}}
				selectedBulkServices={selectedBulkServices}
				allWorkspaces={allWorkspaces}
				selectedTargetProject={selectedTargetProject}
				setSelectedTargetProject={setSelectedTargetProject}
				selectedTargetEnvironment={selectedTargetEnvironment}
				setSelectedTargetEnvironment={setSelectedTargetEnvironment}
				targetEnvironments={targetEnvironments}
				resetMoveDialog={resetMoveDialog}
				runBulkMove={runBulkMove}
				isBulkActionLoading={isBulkActionLoading}
			/>

			<BulkDeleteDialog
				open={isBulkDeleteDialogOpen}
				onOpenChange={(open) => {
					if (open) {
						setIsBulkDeleteDialogOpen(true);
						return;
					}
					resetBulkDeleteDialog();
				}}
				selectedBulkServices={selectedBulkServices}
				selectedBulkRunningServices={selectedBulkRunningServices}
				deleteComposeVolumes={deleteComposeVolumes}
				setDeleteComposeVolumes={setDeleteComposeVolumes}
				resetBulkDeleteDialog={resetBulkDeleteDialog}
				runBulkDelete={runBulkDelete}
				isBulkActionLoading={isBulkActionLoading}
			/>

			<DuplicateServicesDialog
				open={isDuplicateDialogOpen}
				onOpenChange={(open) => {
					if (open) {
						setIsDuplicateDialogOpen(true);
						return;
					}
					resetDuplicateDialog();
				}}
				selectedBulkServices={selectedBulkServices}
				allWorkspaces={allWorkspaces}
				duplicateMode={duplicateMode}
				setDuplicateMode={setDuplicateMode}
				duplicateName={duplicateName}
				setDuplicateName={setDuplicateName}
				duplicateDescription={duplicateDescription}
				setDuplicateDescription={setDuplicateDescription}
				duplicateTargetProject={duplicateTargetProject}
				setDuplicateTargetProject={setDuplicateTargetProject}
				duplicateTargetEnvironment={duplicateTargetEnvironment}
				setDuplicateTargetEnvironment={setDuplicateTargetEnvironment}
				duplicateProjectEnvironments={duplicateProjectEnvironments}
				resetDuplicateDialog={resetDuplicateDialog}
				runBulkDuplicate={runBulkDuplicate}
				isDuplicatePending={duplicateProject.isPending}
			/>

			<CommandBarDialog
				open={commandOpen}
				onOpenChange={(open) => {
					setCommandOpen(open);
					if (!open) setCommandQuery("");
				}}
				commandQuery={commandQuery}
				setCommandQuery={setCommandQuery}
				filteredCommandItems={filteredCommandItems}
				commandGroups={commandGroups}
			/>

			{permissions?.service.create && workspace && (
				<>
					<AddApplication
						projectName={workspace.workspace.name}
						environmentId={environmentId}
						{...getCreateDialogProps("application")}
					/>
					<AddDatabase
						projectName={workspace.workspace.name}
						environmentId={environmentId}
						initialType={createDatabaseType}
						{...getCreateDialogProps("database")}
					/>
					<AddCompose
						projectName={workspace.workspace.name}
						environmentId={environmentId}
						{...getCreateDialogProps("compose")}
					/>
					<AddTemplate
						environmentId={environmentId}
						{...getCreateDialogProps("template")}
					/>
					<AddImport
						projectName={workspace.workspace.name}
						environmentId={environmentId}
						{...getCreateDialogProps("import")}
					/>
				</>
			)}
		</div>
	);
};
