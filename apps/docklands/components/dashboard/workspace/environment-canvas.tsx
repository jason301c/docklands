"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import {
	Background,
	BackgroundVariant,
	type Connection,
	ControlButton,
	Controls,
	type Edge,
	type NodeChange,
	Panel,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	ArrowRight,
	ArrowUpDown,
	Box,
	Cable,
	CheckCircle2,
	CircuitBoard,
	Command,
	Database,
	ExternalLink,
	FileInput,
	Folder,
	FolderInput,
	GitPullRequest,
	GlobeIcon,
	Grid2x2,
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
	SlidersHorizontal,
	SquareTerminal,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
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
import { ShowDeployments } from "@/components/dashboard/application/deployments/show-deployments";
import { ShowDomains } from "@/components/dashboard/application/domains/show-domains";
import { ShowApplicationEnvironment } from "@/components/dashboard/application/environment/show";
import { ShowServiceEnvironment } from "@/components/dashboard/application/environment/show-environment";
import { ShowDockerLogs } from "@/components/dashboard/application/logs/show";
import { ShowPreviewDeployments } from "@/components/dashboard/application/preview-deployments/show-preview-deployments";
import { ShowVolumeBackups } from "@/components/dashboard/application/volume-backups/show-volume-backups";
import { ShowComposeContainers } from "@/components/dashboard/compose/containers/show-compose-containers";
import { ShowDockerLogsCompose } from "@/components/dashboard/compose/logs/show";
import { ShowDockerLogsStack } from "@/components/dashboard/compose/logs/show-stack";
import { ShowBackups } from "@/components/dashboard/database-service/backups/show-backups";
import { ShowExternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-external-database-credentials";
import { ShowInternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-internal-database-credentials";
import { ComposeMonitoring } from "@/components/dashboard/metrics/container/show-compose-monitoring";
import { ContainerMonitoring } from "@/components/dashboard/metrics/container/show-container-monitoring";
import { DeleteService } from "@/components/dashboard/service/delete-service";
import { ShowResources } from "@/components/dashboard/shared/show-resources";
import { ShowVolumes } from "@/components/dashboard/shared/show-volumes";
import { ServiceTerminalModal } from "@/components/dashboard/shared/terminal/service-terminal-modal";
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
import {
	formatLastDeployment,
	type ServiceFlowNode,
	ServiceNode,
	type ServiceNodeData,
	serviceStatusMeta,
	WorkspaceServiceIcon,
} from "@/components/dashboard/workspace/canvas/service-node";
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
import { DropdownMenu } from "@/components/shared/dropdown";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";
import { Select } from "@/components/shared/select";
import { ErrorState } from "@/components/shared/states";
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
	type WorkspaceServiceType,
} from "@/shared/workspace-graph";

const logger = createClientLogger("workspace-canvas");

// Stable reference so React Flow doesn't re-register node types each render.
const CANVAS_NODE_TYPES = { service: ServiceNode };

type WorkspaceData = RouterOutputs["workspaceGraph"]["byEnvironment"];
type WorkspaceConnection = WorkspaceData["connections"][number];

type SelectedServiceRef = {
	serviceId: string;
	serviceType: WorkspaceServiceType;
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
	const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
	const [showGrid, setShowGrid] = useState(true);
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
		| "backups"
		| "volume-backups"
		| "credentials"
		| "resources"
		| "connections"
	>("overview");
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
	const connectSourceService = connectSource
		? servicesByKey.get(
				getWorkspaceServiceKey(
					connectSource.serviceType,
					connectSource.serviceId,
				),
			)
		: undefined;
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

	// React Flow owns drag interaction; we mirror its position changes into the
	// canonical `nodes` state so edges, groups, and persistence stay in sync.
	const onNodesChange = useCallback(
		(changes: NodeChange<ServiceFlowNode>[]) => {
			setNodes((current) => {
				let next = current;
				for (const change of changes) {
					if (change.type !== "position" || !change.position) continue;
					const movedKey = change.id;
					const position = change.position;
					next = next.map((node) =>
						getWorkspaceServiceKey(node.serviceType, node.serviceId) ===
						movedKey
							? { ...node, x: position.x, y: position.y }
							: node,
					);
				}
				return next;
			});
		},
		[],
	);

	// Persist a node's final position once a drag settles. The pending guard keeps
	// an in-flight refetch from snapping the card back before our save lands.
	const persistNodePosition = useCallback(
		(key: string, x: number, y: number) => {
			const node = nodesByKey.get(key);
			if (!node) return;
			pendingNodeKeys.current.add(key);
			void persistNode({ ...node, x, y })
				.catch((error) => {
					logger.error("Could not save service position", error);
					toast.error(
						`Could not save service position: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
				})
				.finally(() => {
					setTimeout(() => {
						pendingNodeKeys.current.delete(key);
					}, 750);
				});
		},
		[nodesByKey, persistNode],
	);

	const startConnectionFromService = (service: WorkspaceService) => {
		setConnectSource({
			serviceId: service.id,
			serviceType: service.type,
		});
		closeSelectedService();
		toast.info(
			"Select a target service, or drag from a card handle. Database links auto-apply variables when possible.",
		);
	};

	// Shared connect path: normalize endpoints, create the link, and apply any
	// generated connection variables. Used by both click-to-connect (connectSource)
	// and React Flow's drag-between-handles (`onConnect`).
	const connectServices = async (
		sourceRef: SelectedServiceRef,
		targetRef: SelectedServiceRef,
	) => {
		if (
			sourceRef.serviceId === targetRef.serviceId &&
			sourceRef.serviceType === targetRef.serviceType
		) {
			return;
		}

		try {
			const normalized = normalizeWorkspaceConnectionEndpoints(
				sourceRef,
				targetRef,
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
				label: canWorkspaceServiceExposeVariables(normalized.source.serviceType)
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
		}
	};

	// React Flow connection (drag from one card's handle to another).
	const onConnect = (connection: Connection) => {
		if (!connection.source || !connection.target) return;
		const source = servicesByKey.get(connection.source);
		const target = servicesByKey.get(connection.target);
		if (!source || !target) return;
		void connectServices(
			{ serviceId: source.id, serviceType: source.type },
			{ serviceId: target.id, serviceType: target.type },
		);
	};

	const selectOrConnectService = async (service: WorkspaceService) => {
		const nextRef = { serviceId: service.id, serviceType: service.type };

		if (isSelectionMode) {
			toggleBulkService(service);
			return;
		}

		if (connectSource) {
			const source = connectSource;
			setConnectSource(null);
			await connectServices(source, nextRef);
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
		setIsSelectionMode(true);
		setSelectedBulkKeys(selectableKeys);
		closeSelectedService();
	};

	const resetCanvasFilters = () => {
		setSearchQuery("");
		setServiceKindFilter("all");
		setServiceStatusFilter("all");
	};

	const toggleTopologyPanel = () => {
		if (connectSource) {
			setConnectSource(null);
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
			),
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

	const rfNodes = useMemo<ServiceFlowNode[]>(
		() =>
			nodes.flatMap((node) => {
				const key = getWorkspaceServiceKey(node.serviceType, node.serviceId);
				const service = servicesByKey.get(key);
				if (!service) return [];
				const isActive =
					selectedService?.serviceId === service.id &&
					selectedService.serviceType === service.type;
				const isConnectSource =
					connectSource?.serviceId === service.id &&
					connectSource.serviceType === service.type;
				const data: ServiceNodeData = {
					service,
					linkCount: serviceLinkCounts.get(key) ?? 0,
					dimmed: !visibleServiceKeys.has(key),
					selectionMode: isSelectionMode,
					isActive,
					isBulkSelected: selectedBulkKeySet.has(key),
					isConnectSource,
					isConnectCandidate: !!connectSource && !isConnectSource,
				};
				return [
					{
						id: key,
						type: "service" as const,
						position: { x: node.x, y: node.y },
						width: node.width,
						height: node.height,
						draggable: !isSelectionMode,
						data,
					},
				];
			}),
		[
			nodes,
			servicesByKey,
			serviceLinkCounts,
			visibleServiceKeys,
			selectedBulkKeySet,
			connectSource,
			selectedService,
			isSelectionMode,
		],
	);

	const rfEdges = useMemo<Edge[]>(
		() =>
			connections.map((connection) => {
				const sourceKey = getWorkspaceServiceKey(
					connection.sourceServiceType,
					connection.sourceServiceId,
				);
				const targetKey = getWorkspaceServiceKey(
					connection.targetServiceType,
					connection.targetServiceId,
				);
				const dimmed =
					!visibleServiceKeys.has(sourceKey) ||
					!visibleServiceKeys.has(targetKey);
				return {
					id: connection.connectionId,
					source: sourceKey,
					target: targetKey,
					style: { opacity: dimmed ? 0.15 : 0.5 },
				};
			}),
		[connections, visibleServiceKeys],
	);

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
							<p className="truncate text-xs text-kumo-subtle">
								{workspaceStats.services} services · {workspaceStats.running}{" "}
								online · {workspaceStats.errors} failed ·{" "}
								{workspaceStats.connections} links
								{hasCanvasFilters ? ` · ${filteredServices.length} shown` : ""}
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="relative">
							<FocusShortcutInput
								placeholder="Search services..."
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								className="h-9 w-[200px] pr-9"
							/>
							<Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-kumo-subtle" />
						</div>

						<Button
							variant={
								isFilterBarOpen || hasCanvasFilters ? "primary" : "outline"
							}
							onClick={() => setIsFilterBarOpen((current) => !current)}
						>
							<SlidersHorizontal className="size-4" />
							Filters
							{canvasFilterCount > 0 && (
								<Badge className="ml-1">{canvasFilterCount}</Badge>
							)}
						</Button>

						<Button
							aria-label={
								connectSource
									? "Cancel link"
									: isTopologyOpen
										? "Hide topology"
										: "Show topology"
							}
							variant={connectSource || isTopologyOpen ? "primary" : "outline"}
							shape="square"
							onClick={toggleTopologyPanel}
						>
							<Cable className="size-4" />
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
							aria-label="Command menu"
							variant="outline"
							shape="square"
							onClick={() => {
								setCommandQuery("");
								setCommandOpen(true);
							}}
						>
							<Command className="size-4" />
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
					{isFilterBarOpen && (
						<div className="flex basis-full flex-wrap items-center gap-2 rounded-md border bg-kumo-fill/20 px-3 py-2">
							<div className="w-[160px]">
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
							<div className="w-[150px]">
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
							<div className="flex w-[190px] items-center gap-2">
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
						</div>
					)}
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
					<div className="relative min-h-0 min-w-0 overflow-hidden">
						<ReactFlow
							nodes={rfNodes}
							edges={rfEdges}
							nodeTypes={CANVAS_NODE_TYPES}
							onNodesChange={onNodesChange}
							onConnect={onConnect}
							onNodeClick={(_, node) =>
								void selectOrConnectService(node.data.service)
							}
							onNodeDragStop={(_, node) =>
								persistNodePosition(node.id, node.position.x, node.position.y)
							}
							onPaneClick={() => {
								if (connectSource) setConnectSource(null);
							}}
							nodesDraggable={!isSelectionMode}
							nodesConnectable={!isSelectionMode}
							minZoom={0.3}
							maxZoom={1.75}
							fitView
							fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
							proOptions={{ hideAttribution: true }}
							className="bg-kumo-fill/20"
						>
							{showGrid && (
								<Background
									variant={BackgroundVariant.Dots}
									gap={24}
									size={1.5}
									color="var(--color-kumo-hairline)"
								/>
							)}
							<Controls showInteractive={false}>
								<ControlButton
									onClick={() => setShowGrid((current) => !current)}
									title={showGrid ? "Hide grid" : "Show grid"}
								>
									<Grid2x2 />
								</ControlButton>
								<ControlButton
									onClick={() => void arrangeWorkspace()}
									title="Auto-arrange layout"
								>
									<Grip />
								</ControlButton>
							</Controls>

							{connectSourceService && (
								<Panel
									position="top-center"
									className="pointer-events-none flex items-center gap-2 rounded-full border bg-kumo-canvas/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
								>
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
								</Panel>
							)}

							{services.length === 0 && (
								<div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-lg border bg-kumo-canvas/95 p-5 text-center shadow-sm backdrop-blur">
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
										<div className="pointer-events-auto flex flex-wrap justify-center gap-2">
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
							)}
						</ReactFlow>
					</div>
				</div>
			</div>

			{selectedServiceModel && (
				<aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-xl flex-col border-l bg-kumo-canvas shadow-xl">
					<div className="flex flex-col gap-4 border-b p-5">
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 items-start gap-3">
								<div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/40">
									<WorkspaceServiceIcon service={selectedServiceModel} />
								</div>
								<div className="min-w-0 space-y-1.5">
									<h2 className="truncate text-lg font-semibold leading-tight">
										{selectedServiceModel.name}
									</h2>
									{(() => {
										const statusMeta = serviceStatusMeta(
											selectedServiceModel.status,
										);
										const subtitle =
											selectedServiceModel.primaryDomain ??
											serviceTypeLabels[selectedServiceModel.type];
										return (
											<div className="flex min-w-0 items-center gap-2 text-sm text-kumo-subtle">
												<span className="flex shrink-0 items-center gap-1.5 text-kumo-default">
													<span
														className={cn(
															"size-2 shrink-0 rounded-full",
															statusMeta.dotClass,
															statusMeta.pulse && "animate-pulse",
														)}
														aria-hidden="true"
													/>
													{statusMeta.label}
												</span>
												<span
													className="shrink-0 text-kumo-subtle/60"
													aria-hidden="true"
												>
													·
												</span>
												<span className="truncate">{subtitle}</span>
											</div>
										);
									})()}
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-1.5">
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										runServiceAction(selectedServiceModel, "deploy")
									}
								>
									<RefreshCw className="size-4" />
									Deploy
								</Button>
								<Link
									href={getServiceSettingsHref(
										workspaceId,
										environmentId,
										selectedServiceModel,
									)}
								>
									<Button
										aria-label="Open full settings"
										variant="ghost"
										shape="square"
									>
										<Settings2 className="size-4" />
									</Button>
								</Link>
								<Button
									aria-label="Close service panel"
									variant="ghost"
									shape="square"
									onClick={closeSelectedService}
								>
									<X className="size-4" />
								</Button>
							</div>
						</div>

						<Tabs
							variant="underline"
							size="sm"
							value={activeDrawerTab}
							onValueChange={(value) =>
								value !== null && setDrawerTab(value as typeof drawerTab)
							}
							tabs={drawerTabs}
							className="-mx-1 -mb-1 overflow-x-auto"
							listClassName="px-1"
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
