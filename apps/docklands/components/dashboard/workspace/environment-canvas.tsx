"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
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
import { ShowPorts } from "@/components/dashboard/application/advanced/ports/show-port";
import { ShowResources } from "@/components/dashboard/application/advanced/show-resources";
import { ShowVolumes } from "@/components/dashboard/application/advanced/volumes/show-volumes";
import { ShowDeployments } from "@/components/dashboard/application/deployments/show-deployments";
import { ShowDomains } from "@/components/dashboard/application/domains/show-domains";
import { ShowEnvironment as ShowApplicationEnvironment } from "@/components/dashboard/application/environment/show";
import { ShowEnvironment as ShowServiceEnvironment } from "@/components/dashboard/application/environment/show-environment";
import { ShowDockerLogs } from "@/components/dashboard/application/logs/show";
import { ShowPreviewDeployments } from "@/components/dashboard/application/preview-deployments/show-preview-deployments";
import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { ShowVolumeBackups } from "@/components/dashboard/application/volume-backups/show-volume-backups";
import { ShowComposeContainers } from "@/components/dashboard/compose/containers/show-compose-containers";
import { DeleteService } from "@/components/dashboard/compose/delete-service";
import { ShowDockerLogsCompose } from "@/components/dashboard/compose/logs/show";
import { ShowDockerLogsStack } from "@/components/dashboard/compose/logs/show-stack";
import { ShowBackups } from "@/components/dashboard/database/backups/show-backups";
import { ShowExternalLibsqlCredentials } from "@/components/dashboard/libsql/general/show-external-libsql-credentials";
import { ShowInternalLibsqlCredentials } from "@/components/dashboard/libsql/general/show-internal-libsql-credentials";
import { ShowExternalMariadbCredentials } from "@/components/dashboard/mariadb/general/show-external-mariadb-credentials";
import { ShowInternalMariadbCredentials } from "@/components/dashboard/mariadb/general/show-internal-mariadb-credentials";
import { ShowExternalMongoCredentials } from "@/components/dashboard/mongo/general/show-external-mongo-credentials";
import { ShowInternalMongoCredentials } from "@/components/dashboard/mongo/general/show-internal-mongo-credentials";
import { ComposeFreeMonitoring } from "@/components/dashboard/monitoring/free/container/show-free-compose-monitoring";
import { ContainerFreeMonitoring } from "@/components/dashboard/monitoring/free/container/show-free-container-monitoring";
import { ShowExternalMysqlCredentials } from "@/components/dashboard/mysql/general/show-external-mysql-credentials";
import { ShowInternalMysqlCredentials } from "@/components/dashboard/mysql/general/show-internal-mysql-credentials";
import { ShowExternalPostgresCredentials } from "@/components/dashboard/postgres/general/show-external-postgres-credentials";
import { ShowInternalPostgresCredentials } from "@/components/dashboard/postgres/general/show-internal-postgres-credentials";
import { AddApplication } from "@/components/dashboard/project/add-application";
import { AddCompose } from "@/components/dashboard/project/add-compose";
import { AddDatabase } from "@/components/dashboard/project/add-database";
import { AddImport } from "@/components/dashboard/project/add-import";
import { AddTemplate } from "@/components/dashboard/project/add-template";
import { AdvancedEnvironmentSelector } from "@/components/dashboard/project/advanced-environment-selector";
import { EnvironmentVariables } from "@/components/dashboard/project/environment-variables";
import { ProjectEnvironment } from "@/components/dashboard/projects/project-environment";
import { ShowExternalRedisCredentials } from "@/components/dashboard/redis/general/show-external-redis-credentials";
import { ShowInternalRedisCredentials } from "@/components/dashboard/redis/general/show-internal-redis-credentials";
import { DockerTerminalModal } from "@/components/dashboard/settings/web-server/docker-terminal-modal";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { AdvanceBreadcrumb } from "@/components/shared/advance-breadcrumb";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import { toast } from "@/components/shared/toast";
import { parseEnvironmentVariables } from "@/shared/env-string";
import { cn } from "@/shared/utils";
import {
	canWorkspaceServiceExposeVariables,
	getDefaultWorkspacePosition,
	getWorkspaceServiceKey,
	isWorkspaceServiceType,
	normalizeWorkspaceConnectionEndpoints,
	resolveWorkspaceConnectionGroups,
	type WorkspaceNode,
	type WorkspaceService,
	type WorkspaceServiceType,
} from "@/shared/workspace-graph";

type WorkspaceData = RouterOutputs["workspace"]["byEnvironment"];
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

type CommandGroup =
	| "Create"
	| "Environments"
	| "Services"
	| "Actions"
	| "System";

type CommandItem = {
	id: string;
	group: CommandGroup;
	label: string;
	detail: string;
	search: string;
	icon: ReactNode;
	run: () => void;
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

const serviceTypeLabels: Record<WorkspaceServiceType, string> = {
	application: "Application",
	compose: "Compose",
	libsql: "LibSQL",
	mariadb: "MariaDB",
	mongo: "MongoDB",
	mysql: "MySQL",
	postgres: "PostgreSQL",
	redis: "Redis",
};

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
	{ value: "last-deploy-desc", label: "Recent deploy" },
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

const serviceIconClassName = "size-6 text-muted-foreground";

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

const ConnectionVariablePreview = ({
	connectionId,
	enabled,
}: {
	connectionId: string;
	enabled: boolean;
}) => {
	const variablesQuery = api.workspace.connectionVariables.useQuery(
		{ connectionId },
		{ enabled },
	);

	if (!enabled) return null;

	if (variablesQuery.isPending) {
		return (
			<p className="text-xs text-muted-foreground">Loading variable keys...</p>
		);
	}

	if (!variablesQuery.data?.length) {
		return (
			<p className="text-xs text-muted-foreground">
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

const getActionInput = (service: WorkspaceService) => {
	switch (service.type) {
		case "application":
			return { applicationId: service.id };
		case "compose":
			return { composeId: service.id };
		case "postgres":
			return { postgresId: service.id };
		case "mysql":
			return { mysqlId: service.id };
		case "mariadb":
			return { mariadbId: service.id };
		case "redis":
			return { redisId: service.id };
		case "mongo":
			return { mongoId: service.id };
		case "libsql":
			return { libsqlId: service.id };
	}
};

const getDeleteInput = (service: WorkspaceService, deleteVolumes: boolean) => {
	if (service.type === "compose") {
		return { composeId: service.id, deleteVolumes };
	}

	return getActionInput(service);
};

const getServiceSettingsHref = (
	projectId: string,
	environmentId: string,
	service: WorkspaceService,
) =>
	`/dashboard/project/${projectId}/environment/${environmentId}/services/${service.type}/${service.id}`;

const formatLastDeploy = (lastDeployAt?: string | null) =>
	lastDeployAt
		? formatDistanceToNow(new Date(lastDeployAt), { addSuffix: true })
		: "No deploys yet";

const getDatabaseBackupType = (service: WorkspaceService) =>
	databaseBackupServiceTypes.has(service.type)
		? (service.type as "libsql" | "mariadb" | "mongo" | "mysql" | "postgres")
		: undefined;

const hasDatabaseCredentials = (service: WorkspaceService) =>
	databaseCredentialServiceTypes.has(service.type);

const DatabaseCredentials = ({ service }: { service: WorkspaceService }) => {
	if (service.type === "postgres") {
		return (
			<div className="space-y-4">
				<ShowInternalPostgresCredentials postgresId={service.id} />
				<ShowExternalPostgresCredentials postgresId={service.id} />
			</div>
		);
	}

	if (service.type === "mysql") {
		return (
			<div className="space-y-4">
				<ShowInternalMysqlCredentials mysqlId={service.id} />
				<ShowExternalMysqlCredentials mysqlId={service.id} />
			</div>
		);
	}

	if (service.type === "mariadb") {
		return (
			<div className="space-y-4">
				<ShowInternalMariadbCredentials mariadbId={service.id} />
				<ShowExternalMariadbCredentials mariadbId={service.id} />
			</div>
		);
	}

	if (service.type === "mongo") {
		return (
			<div className="space-y-4">
				<ShowInternalMongoCredentials mongoId={service.id} />
				<ShowExternalMongoCredentials mongoId={service.id} />
			</div>
		);
	}

	if (service.type === "redis") {
		return (
			<div className="space-y-4">
				<ShowInternalRedisCredentials redisId={service.id} />
				<ShowExternalRedisCredentials redisId={service.id} />
			</div>
		);
	}

	if (service.type === "libsql") {
		return (
			<div className="space-y-4">
				<ShowInternalLibsqlCredentials libsqlId={service.id} />
				<ShowExternalLibsqlCredentials libsqlId={service.id} />
			</div>
		);
	}

	return null;
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
		<DockerTerminalModal
			appName={service.appName}
			serverId={service.serverId || ""}
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
		</DockerTerminalModal>
	);
};

export const EnvironmentCanvas = ({
	projectId,
	environmentId,
}: {
	projectId: string;
	environmentId: string;
}) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const utils = api.useUtils();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const workspaceQuery = api.workspace.byEnvironment.useQuery({
		environmentId,
	});
	const workspace = workspaceQuery.data;
	const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
	const [selectedService, setSelectedService] =
		useState<SelectedServiceRef | null>(null);
	const [connectSource, setConnectSource] = useState<SelectedServiceRef | null>(
		null,
	);
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
		"new-project" | "existing-environment"
	>("new-project");
	const [duplicateName, setDuplicateName] = useState("");
	const [duplicateDescription, setDuplicateDescription] = useState("");
	const [duplicateTargetProject, setDuplicateTargetProject] = useState("");
	const [duplicateTargetEnvironment, setDuplicateTargetEnvironment] =
		useState("");
	const [selectedTargetProject, setSelectedTargetProject] = useState("");
	const [selectedTargetEnvironment, setSelectedTargetEnvironment] =
		useState("");
	const dragState = useRef<DragState | null>(null);
	const suppressClick = useRef(false);
	const { data: allProjects } = api.project.all.useQuery(undefined, {
		enabled: isSelectionMode,
	});
	const { data: projectEnvironments } = api.environment.byProjectId.useQuery(
		{ projectId },
		{ enabled: commandOpen },
	);
	const { data: selectedProjectEnvironments } =
		api.environment.byProjectId.useQuery(
			{ projectId: selectedTargetProject },
			{ enabled: isMoveDialogOpen && !!selectedTargetProject },
		);
	const { data: duplicateProjectEnvironments } =
		api.environment.byProjectId.useQuery(
			{ projectId: duplicateTargetProject },
			{ enabled: isDuplicateDialogOpen && !!duplicateTargetProject },
		);

	const updateNode = api.workspace.updateNode.useMutation();
	const connect = api.workspace.connect.useMutation();
	const removeConnection = api.workspace.removeConnection.useMutation();
	const applyConnectionVariables =
		api.workspace.applyConnectionVariables.useMutation();
	const syncConnectionVariables =
		api.workspace.syncServiceConnectionVariables.useMutation();
	const duplicateProject = api.project.duplicate.useMutation();

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
		postgres: {
			start: api.postgres.start.useMutation(),
			stop: api.postgres.stop.useMutation(),
			deploy: api.postgres.deploy.useMutation(),
			move: api.postgres.move.useMutation(),
			delete: api.postgres.remove.useMutation(),
		},
		mysql: {
			start: api.mysql.start.useMutation(),
			stop: api.mysql.stop.useMutation(),
			deploy: api.mysql.deploy.useMutation(),
			move: api.mysql.move.useMutation(),
			delete: api.mysql.remove.useMutation(),
		},
		mariadb: {
			start: api.mariadb.start.useMutation(),
			stop: api.mariadb.stop.useMutation(),
			deploy: api.mariadb.deploy.useMutation(),
			move: api.mariadb.move.useMutation(),
			delete: api.mariadb.remove.useMutation(),
		},
		redis: {
			start: api.redis.start.useMutation(),
			stop: api.redis.stop.useMutation(),
			deploy: api.redis.deploy.useMutation(),
			move: api.redis.move.useMutation(),
			delete: api.redis.remove.useMutation(),
		},
		mongo: {
			start: api.mongo.start.useMutation(),
			stop: api.mongo.stop.useMutation(),
			deploy: api.mongo.deploy.useMutation(),
			move: api.mongo.move.useMutation(),
			delete: api.mongo.remove.useMutation(),
		},
		libsql: {
			start: api.libsql.start.useMutation(),
			stop: api.libsql.stop.useMutation(),
			deploy: api.libsql.deploy.useMutation(),
			move: api.libsql.move.useMutation(),
			delete: api.libsql.remove.useMutation(),
		},
	};

	useEffect(() => {
		if (workspace?.nodes) setNodes(workspace.nodes);
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

	const services = workspace?.services ?? [];
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
		setSelectedBulkKeys((current) =>
			current.filter((key) => servicesByKey.has(key)),
		);
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
			? [{ value: "schedules", label: "Schedules" }]
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

	useEffect(() => {
		if (
			drawerTab === "previews" &&
			selectedServiceModel?.type !== "application"
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "deployments" &&
			(!selectedServiceModel ||
				!deploymentServiceTypes.has(selectedServiceModel.type) ||
				!permissions?.deployment.read)
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "domains" &&
			(!selectedServiceModel ||
				!deploymentServiceTypes.has(selectedServiceModel.type) ||
				!permissions?.domain.read)
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "logs" &&
			(!selectedServiceModel?.appName || !permissions?.logs.read)
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "terminal" &&
			(!selectedServiceModel?.appName || !permissions?.service.read)
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "schedules" &&
			(!selectedServiceModel ||
				!deploymentServiceTypes.has(selectedServiceModel.type) ||
				!permissions?.schedule.read)
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "backups" &&
			(!selectedServiceModel ||
				(selectedServiceModel.type !== "compose" &&
					!getDatabaseBackupType(selectedServiceModel)))
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "credentials" &&
			(!selectedServiceModel || !hasDatabaseCredentials(selectedServiceModel))
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "resources" &&
			(!selectedServiceModel ||
				(!permissions?.service.create && !permissions?.volume.read))
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "volume-backups" &&
			(!selectedServiceModel ||
				!deploymentServiceTypes.has(selectedServiceModel.type) ||
				!permissions?.volumeBackup.read)
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "containers" &&
			(selectedServiceModel?.type !== "compose" || !permissions?.service.read)
		) {
			setDrawerTab("overview");
		}
		if (
			drawerTab === "metrics" &&
			(!selectedServiceModel?.appName || !permissions?.monitoring.read)
		) {
			setDrawerTab("overview");
		}
	}, [
		drawerTab,
		permissions?.deployment.read,
		permissions?.domain.read,
		permissions?.logs.read,
		permissions?.monitoring.read,
		permissions?.schedule.read,
		permissions?.service.read,
		permissions?.service.create,
		permissions?.volume.read,
		permissions?.volumeBackup.read,
		selectedServiceModel,
	]);

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
	const connectionGroups = useMemo(
		() => resolveWorkspaceConnectionGroups(nodes, connections),
		[nodes, connections],
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
	const projectVariableKeys = useMemo(
		() =>
			parseEnvironmentVariables(workspace?.environment.env)
				.map((entry) => entry.key)
				.sort((a, b) => a.localeCompare(b)),
		[workspace?.environment.env],
	);
	const workspaceStats = useMemo(
		() => ({
			services: services.length,
			running: services.filter((service) => service.status === "running")
				.length,
			errors: services.filter((service) => service.status === "error").length,
			connections: connections.length,
		}),
		[connections.length, services],
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
			await utils.workspace.byEnvironment.invalidate({ environmentId });
		},
		[environmentId, updateNode, utils.workspace.byEnvironment],
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

		try {
			await persistNode(node);
		} catch (error) {
			toast.error(
				`Could not save service position: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
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
				await utils.workspace.byEnvironment.invalidate({ environmentId });
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
				toast.error(
					`Could not connect services: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			} finally {
				setConnectSource(null);
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

	const resetCanvasFilters = () => {
		setSearchQuery("");
		setServiceKindFilter("all");
		setServiceStatusFilter("all");
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
		setDuplicateMode("new-project");
		setDuplicateName("");
		setDuplicateDescription("");
		setDuplicateTargetProject("");
		setDuplicateTargetEnvironment("");
	};

	const openMoveDialog = () => {
		setSelectedTargetProject(projectId);
		setSelectedTargetEnvironment("");
		setIsMoveDialogOpen(true);
	};

	const runServiceAction = async (
		service: WorkspaceService,
		action: "start" | "stop" | "deploy",
	) => {
		const mutation = serviceActions[service.type][action];
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
				await utils.workspace.byEnvironment.invalidate({ environmentId });
				return action === "deploy"
					? `${service.name} queued for deployment`
					: `${service.name} ${action === "start" ? "started" : "stopped"}`;
			},
			error: (error) =>
				`Could not ${action} ${service.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
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
				const mutation = serviceActions[service.type][action];
				const actionInput = getActionInput(service);

				try {
					await (mutation.mutateAsync as (input: never) => Promise<unknown>)(
						actionInput as never,
					);
					succeeded++;
				} catch {
					failed++;
				}
			}

			await utils.workspace.byEnvironment.invalidate({ environmentId });
			if (succeeded > 0) {
				toast.success(
					action === "deploy"
						? `${succeeded} services queued for deployment`
						: `${succeeded} services ${action === "start" ? "started" : "stopped"}`,
				);
			}
			if (failed > 0) {
				toast.error(`${failed} services could not ${action}`);
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
			toast.error("Select a target project");
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
				const mutation = serviceActions[service.type].move;
				const actionInput = {
					...getActionInput(service),
					targetEnvironmentId: selectedTargetEnvironment,
				};

				try {
					await (mutation.mutateAsync as (input: never) => Promise<unknown>)(
						actionInput as never,
					);
					succeeded++;
				} catch {
					failed++;
				}
			}

			await utils.workspace.byEnvironment.invalidate({ environmentId });
			await utils.project.all.invalidate();
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
				const mutation = serviceActions[service.type].delete;
				const actionInput = getDeleteInput(service, deleteComposeVolumes);

				try {
					await (mutation.mutateAsync as (input: never) => Promise<unknown>)(
						actionInput as never,
					);
					succeeded++;
				} catch {
					failed++;
				}
			}

			await utils.workspace.byEnvironment.invalidate({ environmentId });
			await utils.project.all.invalidate();
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
		if (duplicateMode === "new-project" && !duplicateName.trim()) {
			toast.error("Project name is required");
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

			await utils.project.all.invalidate();
			if (
				duplicateMode === "existing-environment" &&
				duplicateTargetEnvironment === environmentId
			) {
				await utils.workspace.byEnvironment.invalidate({ environmentId });
			}
			toast.success(
				duplicateMode === "new-project"
					? "Services duplicated to a new project"
					: "Services duplicated",
			);
			resetDuplicateDialog();

			if (duplicateMode === "new-project" && newEnvironment?.projectId) {
				router.push(
					`/dashboard/project/${newEnvironment.projectId}/environment/${newEnvironment.environmentId}`,
				);
			}
		} catch (error) {
			toast.error(
				`Could not duplicate services: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	const removeSelectedConnection = async (connection: WorkspaceConnection) => {
		await removeConnection.mutateAsync({
			connectionId: connection.connectionId,
		});
		await utils.workspace.byEnvironment.invalidate({ environmentId });
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
			case "postgres":
				await utils.postgres.one.invalidate({ postgresId: service.serviceId });
				break;
			case "mysql":
				await utils.mysql.one.invalidate({ mysqlId: service.serviceId });
				break;
			case "mariadb":
				await utils.mariadb.one.invalidate({ mariadbId: service.serviceId });
				break;
			case "mongo":
				await utils.mongo.one.invalidate({ mongoId: service.serviceId });
				break;
			case "redis":
				await utils.redis.one.invalidate({ redisId: service.serviceId });
				break;
			case "libsql":
				await utils.libsql.one.invalidate({ libsqlId: service.serviceId });
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
					await utils.workspace.byEnvironment.invalidate({ environmentId });
					return "Workspace arranged";
				},
				error: (error) =>
					`Could not arrange workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
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
						detail: "Create a deployable app service",
						search:
							"new create application app service deploy git docker image builder",
						icon: <Folder className="size-5 text-muted-foreground" />,
						run: () => openCreateDialog("application"),
					},
					{
						id: "create:database",
						group: "Create" as const,
						label: "New database",
						detail: "Provision Postgres, Redis, MySQL, and more",
						search:
							"new create database postgres redis mysql mariadb mongo libsql",
						icon: <Database className="size-5 text-muted-foreground" />,
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
						detail: "Create a Docker Compose service group",
						search: "new create compose stack docker compose",
						icon: <CircuitBoard className="size-5 text-muted-foreground" />,
						run: () => openCreateDialog("compose"),
					},
					{
						id: "create:template",
						group: "Create" as const,
						label: "Deploy template",
						detail: "Browse and deploy a template",
						search: "new create deploy template catalog starter marketplace",
						icon: <PuzzleIcon className="size-5 text-muted-foreground" />,
						run: () => openCreateDialog("template"),
					},
					{
						id: "create:import",
						group: "Create" as const,
						label: "Import compose",
						detail: "Import a base64 compose export",
						search: "new create import compose export base64 template",
						icon: <FileInput className="size-5 text-muted-foreground" />,
						run: () => openCreateDialog("import"),
					},
				]
			: []),
		...(projectEnvironments?.map((environment) => {
			const serviceCount =
				environment.applications.length +
				environment.compose.length +
				environment.libsql.length +
				environment.mariadb.length +
				environment.mongo.length +
				environment.mysql.length +
				environment.postgres.length +
				environment.redis.length;

			return {
				id: `environment:${environment.environmentId}`,
				group: "Environments" as const,
				label: environment.name,
				detail:
					environment.environmentId === environmentId
						? "Current environment"
						: `${serviceCount} ${serviceCount === 1 ? "service" : "services"}`,
				search: `${environment.name} environment switch open ${environment.description ?? ""}`,
				icon: <GlobeIcon className="size-5 text-muted-foreground" />,
				run: () => {
					setCommandOpen(false);
					setCommandQuery("");
					router.push(
						`/dashboard/project/${projectId}/environment/${environment.environmentId}`,
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
					icon: <RefreshCw className="size-5 text-muted-foreground" />,
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
					icon: <Play className="size-5 text-muted-foreground" />,
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
					icon: <X className="size-5 text-muted-foreground" />,
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
					icon: <SquareTerminal className="size-5 text-muted-foreground" />,
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
								label: `Deployments for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · release history`,
								search: `${baseSearch} deployments releases history builds`,
								icon: <Rocket className="size-5 text-muted-foreground" />,
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
								icon: <GlobeIcon className="size-5 text-muted-foreground" />,
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
								icon: (
									<GitPullRequest className="size-5 text-muted-foreground" />
								),
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
					icon: <Cable className="size-5 text-muted-foreground" />,
					run: () => {
						setSelectedService({
							serviceId: service.id,
							serviceType: service.type,
						});
						setDrawerTab("connections");
						setCommandOpen(false);
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
								icon: (
									<SquareTerminal className="size-5 text-muted-foreground" />
								),
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
								icon: (
									<SquareTerminal className="size-5 text-muted-foreground" />
								),
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
								label: `Schedules for ${service.name}`,
								detail: `${serviceTypeLabels[service.type]} · scheduled jobs`,
								search: `${baseSearch} schedules cron jobs tasks automation`,
								icon: <Clock className="size-5 text-muted-foreground" />,
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
								icon: <Database className="size-5 text-muted-foreground" />,
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
								icon: (
									<SquareTerminal className="size-5 text-muted-foreground" />
								),
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
								icon: <Box className="size-5 text-muted-foreground" />,
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
								icon: <Database className="size-5 text-muted-foreground" />,
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
								icon: <Box className="size-5 text-muted-foreground" />,
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
								icon: <RefreshCw className="size-5 text-muted-foreground" />,
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
					icon: <Settings2 className="size-5 text-muted-foreground" />,
					run: () => {
						setCommandOpen(false);
						router.push(
							getServiceSettingsHref(projectId, environmentId, service),
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
						icon: <Grip className="size-5 text-muted-foreground" />,
						run: () => {
							setCommandOpen(false);
							void arrangeWorkspace();
						},
					},
				]
			: []),
		...[
			{
				id: "system:web-server",
				label: "Ingress",
				detail: "Domains, TLS, cleanup, and proxy",
				path: "/dashboard/settings/server",
				search: "ingress web server domain tls ssl proxy traefik cleanup",
				icon: <ServerIcon className="size-5 text-muted-foreground" />,
			},
			{
				id: "system:remote-servers",
				label: "Runtime capacity",
				detail: "Worker machines and placement",
				path: "/dashboard/settings/servers",
				search: "remote servers runtime capacity workers nodes machines",
				icon: <Network className="size-5 text-muted-foreground" />,
			},
			{
				id: "system:git-providers",
				label: "Git providers",
				detail: "GitHub, GitLab, and Gitea",
				path: "/dashboard/settings/git-providers",
				search: "git providers github gitlab gitea oauth",
				icon: <FolderInput className="size-5 text-muted-foreground" />,
			},
			{
				id: "system:registry",
				label: "Registry",
				detail: "Container image registries",
				path: "/dashboard/settings/registry",
				search: "registry docker image container credentials",
				icon: <Box className="size-5 text-muted-foreground" />,
			},
			{
				id: "system:ssh-keys",
				label: "SSH keys",
				detail: "Deploy keys and private keys",
				path: "/dashboard/settings/ssh-keys",
				search: "ssh keys private deploy git",
				icon: <SquareTerminal className="size-5 text-muted-foreground" />,
			},
			{
				id: "system:notifications",
				label: "Notifications",
				detail: "Alerts and integrations",
				path: "/dashboard/settings/notifications",
				search: "notifications alerts discord slack webhook",
				icon: <Command className="size-5 text-muted-foreground" />,
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
			<div className="flex min-h-[70vh] items-center justify-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
				<span>Loading workspace...</span>
			</div>
		);
	}

	if (!workspace) {
		return (
			<div className="flex min-h-[70vh] items-center justify-center text-muted-foreground">
				Workspace not found
			</div>
		);
	}

	return (
		<div className="h-[calc(100vh-5.5rem)] min-h-[720px] overflow-hidden">
			<AdvanceBreadcrumb />

			<div className="grid h-[calc(100%-2.25rem)] grid-rows-[auto_1fr] overflow-hidden rounded-lg border bg-background">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
							<Network className="size-5 text-muted-foreground" />
						</div>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="truncate text-lg font-semibold">
									{workspace.project.name}
								</h1>
								<AdvancedEnvironmentSelector
									projectId={projectId}
									currentEnvironmentId={environmentId}
								/>
							</div>
							<p className="truncate text-sm text-muted-foreground">
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
							<Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
							<ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
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
							variant={connectSource ? "primary" : "outline"}
							onClick={() => setConnectSource(null)}
						>
							<Cable className="size-4" />
							{connectSource ? "Cancel connection" : "Connections"}
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
								<DropdownMenu.Label className="text-sm font-normal">
									System settings
								</DropdownMenu.Label>
								<DropdownMenu.Separator />
								<Link href="/dashboard/settings/server">
									<DropdownMenu.Item className="cursor-pointer">
										Ingress
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/servers">
									<DropdownMenu.Item className="cursor-pointer">
										Runtime capacity
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/git-providers">
									<DropdownMenu.Item className="cursor-pointer">
										Git providers
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/registry">
									<DropdownMenu.Item className="cursor-pointer">
										Registry
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

						<ProjectEnvironment projectId={projectId}>
							<Button variant="outline">
								<Box className="size-4" />
								Project vars
							</Button>
						</ProjectEnvironment>

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
									<DropdownMenu.Label className="text-sm font-normal">
										Add service
									</DropdownMenu.Label>
									<DropdownMenu.Separator />
									<AddApplication
										projectName={workspace.project.name}
										environmentId={environmentId}
									/>
									<AddDatabase
										projectName={workspace.project.name}
										environmentId={environmentId}
									/>
									<AddCompose
										projectName={workspace.project.name}
										environmentId={environmentId}
									/>
									<AddTemplate environmentId={environmentId} />
									<AddImport
										projectName={workspace.project.name}
										environmentId={environmentId}
									/>
								</DropdownMenu.Content>
							</DropdownMenu>
						)}
					</div>
					{isSelectionMode && (
						<div className="flex basis-full flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<Badge>{selectedBulkServices.length} selected</Badge>
								<span className="text-muted-foreground">
									Select services on the canvas, then run a bulk action.
								</span>
								{selectedBulkRunningServices.length > 0 && (
									<span className="text-destructive">
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

				<div className="relative overflow-auto bg-muted/20">
					<div
						className="relative"
						style={{
							width: canvasBounds.width,
							height: canvasBounds.height,
							backgroundImage:
								"linear-gradient(to right, hsl(var(--border) / .45) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / .45) 1px, transparent 1px)",
							backgroundSize: "32px 32px",
						}}
					>
						{connectionGroups.map((group, index) => (
							<div
								key={group.id}
								className="pointer-events-none absolute rounded-xl border border-dashed border-kumo-line bg-background/35"
								style={{
									left: group.x,
									top: group.y,
									width: group.width,
									height: group.height,
								}}
							>
								<div className="absolute left-3 top-3 rounded-md border bg-background/80 px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm">
									Service group {index + 1} · {group.nodeKeys.length} services
								</div>
							</div>
						))}

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
										className="fill-muted-foreground"
									/>
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
											"fill-none stroke-muted-foreground/60 stroke-2",
											(!sourceVisible || !targetVisible) && "opacity-20",
										)}
										markerEnd="url(#workspace-arrow)"
									/>
								);
							})}
						</svg>

						{services.length === 0 ? (
							<div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center text-muted-foreground">
								<FolderInput className="size-10" />
								<div>
									<p className="font-medium">No services yet</p>
									<p className="text-sm">
										Create an app, database, compose stack, or template.
									</p>
								</div>
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

							return (
								<button
									key={serviceKey}
									type="button"
									onPointerDown={(event) => onNodePointerDown(event, node)}
									onPointerMove={onNodePointerMove}
									onPointerUp={onNodePointerUp}
									onClick={() => selectOrConnectService(service)}
									className={cn(
										"absolute touch-none rounded-lg text-left outline-none transition",
										isSelectionMode
											? "cursor-pointer"
											: "cursor-grab active:cursor-grabbing",
										"focus-visible:ring-2 focus-visible:ring-ring",
										!visible && "pointer-events-none opacity-20",
									)}
									style={{
										left: node.x,
										top: node.y,
										width: node.width,
										height: node.height,
									}}
								>
									<LayerCard
										className={cn(
											"h-full bg-background/95 shadow-sm transition hover:bg-background",
											isConnectSource && "ring-2 ring-primary",
											isBulkSelected && "ring-2 ring-primary",
										)}
									>
										<div className="flex h-full flex-col gap-4">
											<div className="flex items-start justify-between gap-4">
												<div className="flex min-w-0 items-start gap-3">
													<div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
														<WorkspaceServiceIcon service={service} />
													</div>
													<div className="min-w-0">
														<div className="flex items-center gap-2">
															<span className="truncate font-medium">
																{service.name}
															</span>
															<Grip className="size-3 shrink-0 text-muted-foreground" />
														</div>
														<p className="truncate text-xs text-muted-foreground">
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
													<StatusTooltip status={service.status ?? undefined} />
												</div>
											</div>

											<p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
												{service.description ||
													serviceTypeDescriptions[service.type]}
											</p>

											<div className="mt-auto space-y-1 text-xs text-muted-foreground">
												<div className="flex items-center justify-between gap-3">
													<span className="flex min-w-0 items-center gap-1.5">
														<Network className="size-3 shrink-0" />
														<span className="truncate">Private runtime</span>
													</span>
													<span>
														{
															connections.filter(
																(connection) =>
																	connection.sourceServiceId === service.id ||
																	connection.targetServiceId === service.id,
															).length
														}{" "}
														links
													</span>
												</div>
												<div className="flex min-w-0 items-center gap-1.5">
													<RefreshCw className="size-3 shrink-0" />
													<span className="truncate">
														{service.lastDeployAt
															? `Deployed ${formatLastDeploy(service.lastDeployAt)}`
															: "No deploys yet"}
													</span>
												</div>
											</div>
										</div>
									</LayerCard>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{selectedServiceModel && (
				<aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-xl flex-col border-l bg-background shadow-xl">
					<div className="flex items-start justify-between gap-4 border-b p-5">
						<div className="flex min-w-0 gap-3">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-muted/40">
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
								<p className="text-sm text-muted-foreground">
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
							value={drawerTab}
							onValueChange={(value) =>
								value !== null && setDrawerTab(value as typeof drawerTab)
							}
							tabs={drawerTabs}
						/>
					</div>

					<div className="min-h-0 flex-1 overflow-auto p-5">
						{drawerTab === "overview" && (
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

								<LayerCard className="bg-muted/20">
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-sm font-medium">Runtime</span>
											<Badge>{selectedServiceModel.status || "idle"}</Badge>
										</div>
										<div className="grid gap-2 text-sm text-muted-foreground">
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
												<span>Last deploy</span>
												<span className="truncate">
													{formatLastDeploy(selectedServiceModel.lastDeployAt)}
												</span>
											</div>
										</div>
									</div>
								</LayerCard>

								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										onClick={() => {
											setConnectSource({
												serviceId: selectedServiceModel.id,
												serviceType: selectedServiceModel.type,
											});
											closeSelectedService();
											toast.info(
												"Select another service on the canvas. Database links auto-apply variables when possible.",
											);
										}}
									>
										<Cable className="size-4" />
										Connect
									</Button>
									<Link
										href={`/dashboard/project/${projectId}/environment/${environmentId}/services/${selectedServiceModel.type}/${selectedServiceModel.id}`}
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

						{drawerTab === "variables" && (
							<div className="space-y-3">
								<LayerCard className="bg-muted/20">
									<div className="space-y-4">
										<div>
											<p className="text-sm font-medium">Variable graph</p>
											<p className="text-xs text-muted-foreground">
												Project variables are inherited with{" "}
												<code>{"{{project.KEY}}"}</code>. Incoming service links
												can sync generated connection variables into this
												service.
											</p>
										</div>

										<div className="grid gap-3">
											<div className="rounded-md border bg-background/60 p-3">
												<div className="flex items-center justify-between gap-3">
													<span className="text-sm font-medium">
														Project scope
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
														<p className="mt-3 text-xs text-muted-foreground">
															No project variables defined.
														</p>
													))}
												{!permissions?.envVars.read && (
													<p className="mt-3 text-xs text-muted-foreground">
														You need variable read access to see inherited keys.
													</p>
												)}
											</div>

											<div className="rounded-md border bg-background/60 p-3">
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
													<p className="mt-3 text-xs text-muted-foreground">
														No linked services are generating variables for this
														service.
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
																<div
																	key={connection.connectionId}
																	className="space-y-2 rounded-md border bg-background p-3"
																>
																	<div className="flex items-center justify-between gap-3">
																		<span className="truncate text-sm">
																			{source?.name ?? "Unknown service"}
																		</span>
																		<Badge>
																			{serviceTypeLabels[
																				connection.sourceServiceType
																			] ?? connection.sourceServiceType}
																		</Badge>
																	</div>
																	<ConnectionVariablePreview
																		connectionId={connection.connectionId}
																		enabled={!!permissions?.envVars.read}
																	/>
																</div>
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

						{drawerTab === "deployments" &&
							(selectedServiceModel.type === "application" ||
								selectedServiceModel.type === "compose") && (
								<ShowDeployments
									id={selectedServiceModel.id}
									type={selectedServiceModel.type}
									serverId={selectedServiceModel.serverId || ""}
									refreshToken={selectedServiceModel.refreshToken || ""}
								/>
							)}

						{drawerTab === "domains" &&
							(selectedServiceModel.type === "application" ||
								selectedServiceModel.type === "compose") && (
								<ShowDomains
									id={selectedServiceModel.id}
									type={selectedServiceModel.type}
								/>
							)}

						{drawerTab === "previews" &&
							selectedServiceModel.type === "application" && (
								<ShowPreviewDeployments
									applicationId={selectedServiceModel.id}
								/>
							)}

						{drawerTab === "schedules" &&
							(selectedServiceModel.type === "application" ||
								selectedServiceModel.type === "compose") && (
								<ShowSchedules
									id={selectedServiceModel.id}
									scheduleType={selectedServiceModel.type}
								/>
							)}

						{drawerTab === "backups" && (
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
											databaseType={getDatabaseBackupType(selectedServiceModel)}
											backupType="database"
										/>
									)
								)}
							</>
						)}

						{drawerTab === "credentials" &&
							hasDatabaseCredentials(selectedServiceModel) && (
								<DatabaseCredentials service={selectedServiceModel} />
							)}

						{drawerTab === "resources" && (
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

						{drawerTab === "volume-backups" &&
							(selectedServiceModel.type === "application" ||
								selectedServiceModel.type === "compose") && (
								<ShowVolumeBackups
									id={selectedServiceModel.id}
									type={selectedServiceModel.type}
									serverId={selectedServiceModel.serverId || ""}
								/>
							)}

						{drawerTab === "logs" && selectedServiceModel.appName && (
							<div className="space-y-3">
								{selectedServiceModel.type === "compose" ? (
									selectedServiceModel.composeType === "stack" ? (
										<ShowDockerLogsStack
											serverId={selectedServiceModel.serverId || ""}
											appName={selectedServiceModel.appName}
										/>
									) : (
										<ShowDockerLogsCompose
											serverId={selectedServiceModel.serverId || ""}
											appName={selectedServiceModel.appName}
											appType={
												selectedServiceModel.composeType || "docker-compose"
											}
										/>
									)
								) : (
									<ShowDockerLogs
										serverId={selectedServiceModel.serverId || ""}
										appName={selectedServiceModel.appName}
									/>
								)}
							</div>
						)}

						{drawerTab === "terminal" && selectedServiceModel.appName && (
							<LayerCard className="bg-muted/20">
								<div className="flex items-center justify-between gap-4">
									<div className="min-w-0">
										<h3 className="font-medium">Container Terminal</h3>
										<p className="truncate text-sm text-muted-foreground">
											{selectedServiceModel.appName}
										</p>
									</div>
									<ServiceTerminalButton service={selectedServiceModel} />
								</div>
							</LayerCard>
						)}

						{drawerTab === "containers" &&
							selectedServiceModel.type === "compose" &&
							selectedServiceModel.appName && (
								<ShowComposeContainers
									serverId={selectedServiceModel.serverId || ""}
									appName={selectedServiceModel.appName}
									appType={selectedServiceModel.composeType || "docker-compose"}
								/>
							)}

						{drawerTab === "metrics" && selectedServiceModel.appName && (
							<div className="space-y-3">
								{selectedServiceModel.type === "compose" ? (
									<ComposeFreeMonitoring
										serverId={selectedServiceModel.serverId || ""}
										appName={selectedServiceModel.appName}
										appType={
											selectedServiceModel.composeType || "docker-compose"
										}
									/>
								) : (
									<ContainerFreeMonitoring
										appName={selectedServiceModel.appName}
									/>
								)}
							</div>
						)}

						{drawerTab === "connections" && (
							<div className="space-y-3">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="text-sm font-medium">Service graph</p>
										<p className="text-xs text-muted-foreground">
											Incoming database links can sync generated variables into
											this service.
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
									<div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
										No connections yet. Use Connect, then select another service
										on the canvas.
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
											<LayerCard
												key={connection.connectionId}
												className="bg-muted/20"
											>
												<div className="flex items-center justify-between gap-3">
													<div className="min-w-0 space-y-2 text-sm">
														<div className="flex min-w-0 items-center gap-2">
															<span className="truncate">
																{source?.name || "Unknown"}
															</span>
															<ArrowRight className="size-4 shrink-0 text-muted-foreground" />
															<span className="truncate">
																{target?.name || "Unknown"}
															</span>
														</div>
														<p className="text-xs text-muted-foreground">
															{connection.label || "Private network"}
														</p>
														<ConnectionVariablePreview
															connectionId={connection.connectionId}
															enabled={!!permissions?.envVars.read}
														/>
													</div>
													<div className="flex shrink-0 items-center gap-1">
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
													</div>
												</div>
											</LayerCard>
										);
									})
								)}
							</div>
						)}
					</div>
				</aside>
			)}

			<Dialog.Root
				open={isMoveDialogOpen}
				onOpenChange={(open) => {
					if (open) {
						setIsMoveDialogOpen(true);
						return;
					}
					resetMoveDialog();
				}}
			>
				<Dialog className="sm:max-w-lg">
					<div>
						<Dialog.Title>Move Services</Dialog.Title>
						<Dialog.Description>
							Move {selectedBulkServices.length} selected service
							{selectedBulkServices.length === 1 ? "" : "s"} to another
							environment.
						</Dialog.Description>
					</div>

					<div className="space-y-4">
						<div className="space-y-2">
							<p className="text-sm font-medium">Project</p>
							<Select
								aria-label="Target project"
								value={selectedTargetProject}
								onValueChange={(value) => {
									if (value === null) return;
									setSelectedTargetProject(value as string);
									setSelectedTargetEnvironment("");
								}}
							>
								{allProjects?.map((project) => (
									<Select.Option
										key={project.projectId}
										value={project.projectId}
									>
										{project.name}
									</Select.Option>
								))}
							</Select>
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium">Environment</p>
							<Select
								aria-label="Target environment"
								value={selectedTargetEnvironment}
								onValueChange={(value) => {
									if (value !== null) {
										setSelectedTargetEnvironment(value as string);
									}
								}}
							>
								{targetEnvironments.map((environment) => (
									<Select.Option
										key={environment.environmentId}
										value={environment.environmentId}
									>
										{environment.name}
									</Select.Option>
								))}
							</Select>
							{selectedTargetProject && targetEnvironments.length === 0 && (
								<p className="text-xs text-muted-foreground">
									This project has no other environments.
								</p>
							)}
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={resetMoveDialog}>
							Cancel
						</Button>
						<Button
							onClick={() => void runBulkMove()}
							loading={isBulkActionLoading}
							disabled={
								selectedBulkServices.length === 0 ||
								!selectedTargetProject ||
								!selectedTargetEnvironment
							}
						>
							Move services
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>

			<Dialog.Root
				open={isBulkDeleteDialogOpen}
				onOpenChange={(open) => {
					if (open) {
						setIsBulkDeleteDialogOpen(true);
						return;
					}
					resetBulkDeleteDialog();
				}}
			>
				<Dialog className="sm:max-w-lg">
					<div>
						<Dialog.Title>Delete Services</Dialog.Title>
						<Dialog.Description>
							Delete {selectedBulkServices.length} selected service
							{selectedBulkServices.length === 1 ? "" : "s"}. This cannot be
							undone.
						</Dialog.Description>
					</div>

					<div className="space-y-4 text-sm">
						{selectedBulkRunningServices.length > 0 ? (
							<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
								Stop {selectedBulkRunningServices.length} running service
								{selectedBulkRunningServices.length === 1 ? "" : "s"} before
								deleting.
							</div>
						) : (
							<div className="rounded-md border bg-muted/30 p-3">
								{selectedBulkServices.map((service) => (
									<div
										key={getWorkspaceServiceKey(service.type, service.id)}
										className="flex items-center justify-between gap-3 py-1"
									>
										<span className="truncate">{service.name}</span>
										<Badge>{serviceTypeLabels[service.type]}</Badge>
									</div>
								))}
							</div>
						)}

						{selectedBulkServices.some(
							(service) => service.type === "compose",
						) && (
							<div className="flex items-center gap-2">
								<Checkbox
									aria-label="Delete compose volumes too"
									checked={deleteComposeVolumes}
									onCheckedChange={(checked) =>
										setDeleteComposeVolumes(checked === true)
									}
								/>
								<span>Delete compose volumes too</span>
							</div>
						)}
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={resetBulkDeleteDialog}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => void runBulkDelete()}
							loading={isBulkActionLoading}
							disabled={
								selectedBulkServices.length === 0 ||
								selectedBulkRunningServices.length > 0
							}
						>
							Delete services
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>

			<Dialog.Root
				open={isDuplicateDialogOpen}
				onOpenChange={(open) => {
					if (open) {
						setIsDuplicateDialogOpen(true);
						return;
					}
					resetDuplicateDialog();
				}}
			>
				<Dialog className="sm:max-w-lg">
					<div>
						<Dialog.Title>Duplicate Services</Dialog.Title>
						<Dialog.Description>
							Duplicate {selectedBulkServices.length} selected service
							{selectedBulkServices.length === 1 ? "" : "s"}.
						</Dialog.Description>
					</div>

					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-2">
							<Button
								variant={
									duplicateMode === "new-project" ? "primary" : "outline"
								}
								onClick={() => {
									setDuplicateMode("new-project");
									setDuplicateTargetProject("");
									setDuplicateTargetEnvironment("");
								}}
							>
								New project
							</Button>
							<Button
								variant={
									duplicateMode === "existing-environment"
										? "primary"
										: "outline"
								}
								onClick={() => setDuplicateMode("existing-environment")}
							>
								Environment
							</Button>
						</div>

						{duplicateMode === "new-project" ? (
							<div className="space-y-3">
								<div className="space-y-2">
									<label
										className="text-sm font-medium"
										htmlFor="duplicate-project-name"
									>
										Project name
									</label>
									<Input
										id="duplicate-project-name"
										value={duplicateName}
										onChange={(event) => setDuplicateName(event.target.value)}
										placeholder="New project"
									/>
								</div>
								<div className="space-y-2">
									<label
										className="text-sm font-medium"
										htmlFor="duplicate-project-description"
									>
										Description
									</label>
									<Input
										id="duplicate-project-description"
										value={duplicateDescription}
										onChange={(event) =>
											setDuplicateDescription(event.target.value)
										}
										placeholder="Optional"
									/>
								</div>
							</div>
						) : (
							<div className="space-y-3">
								<div className="space-y-2">
									<p className="text-sm font-medium">Project</p>
									<Select
										aria-label="Target project"
										value={duplicateTargetProject}
										onValueChange={(value) => {
											if (value === null) return;
											setDuplicateTargetProject(value as string);
											setDuplicateTargetEnvironment("");
										}}
									>
										{allProjects?.map((project) => (
											<Select.Option
												key={project.projectId}
												value={project.projectId}
											>
												{project.name}
											</Select.Option>
										))}
									</Select>
								</div>
								<div className="space-y-2">
									<p className="text-sm font-medium">Environment</p>
									<Select
										aria-label="Target environment"
										value={duplicateTargetEnvironment}
										onValueChange={(value) => {
											if (value !== null) {
												setDuplicateTargetEnvironment(value as string);
											}
										}}
									>
										{duplicateProjectEnvironments?.map((environment) => (
											<Select.Option
												key={environment.environmentId}
												value={environment.environmentId}
											>
												{environment.name}
											</Select.Option>
										))}
									</Select>
								</div>
							</div>
						)}

						<div className="rounded-md border bg-muted/30 p-3 text-sm">
							{selectedBulkServices.map((service) => (
								<div
									key={getWorkspaceServiceKey(service.type, service.id)}
									className="flex items-center justify-between gap-3 py-1"
								>
									<span className="truncate">{service.name}</span>
									<Badge>{serviceTypeLabels[service.type]}</Badge>
								</div>
							))}
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={resetDuplicateDialog}>
							Cancel
						</Button>
						<Button
							onClick={() => void runBulkDuplicate()}
							loading={duplicateProject.isPending}
							disabled={
								selectedBulkServices.length === 0 ||
								(duplicateMode === "new-project" && !duplicateName.trim()) ||
								(duplicateMode === "existing-environment" &&
									!duplicateTargetEnvironment)
							}
						>
							Duplicate services
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>

			<Dialog.Root
				open={commandOpen}
				onOpenChange={(open) => {
					setCommandOpen(open);
					if (!open) setCommandQuery("");
				}}
			>
				<Dialog className="sm:max-w-2xl">
					<div>
						<Dialog.Title>Command Bar</Dialog.Title>
					</div>
					<div className="relative">
						<FocusShortcutInput
							autoFocus
							placeholder="Search commands..."
							value={commandQuery}
							onChange={(event) => setCommandQuery(event.target.value)}
							className="pr-9"
						/>
						<Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					</div>
					<div className="max-h-[22rem] space-y-2 overflow-auto">
						{filteredCommandItems.length === 0 ? (
							<div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
								No commands found.
							</div>
						) : (
							commandGroups.map((group) => {
								const items = filteredCommandItems.filter(
									(item) => item.group === group,
								);
								if (items.length === 0) return null;

								return (
									<div key={group} className="space-y-1">
										<div className="px-1 text-xs font-medium uppercase text-muted-foreground">
											{group}
										</div>
										{items.map((item) => (
											<button
												key={item.id}
												type="button"
												className="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left hover:bg-muted/40"
												onClick={item.run}
											>
												<span className="flex min-w-0 items-center gap-3">
													<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/30">
														{item.icon}
													</span>
													<span className="min-w-0">
														<span className="block truncate text-sm font-medium">
															{item.label}
														</span>
														<span className="block truncate text-xs text-muted-foreground">
															{item.detail}
														</span>
													</span>
												</span>
												<ArrowRight className="size-4 shrink-0 text-muted-foreground" />
											</button>
										))}
									</div>
								);
							})
						)}
					</div>
				</Dialog>
			</Dialog.Root>

			{permissions?.service.create && workspace && (
				<>
					<AddApplication
						projectName={workspace.project.name}
						environmentId={environmentId}
						{...getCreateDialogProps("application")}
					/>
					<AddDatabase
						projectName={workspace.project.name}
						environmentId={environmentId}
						initialType={createDatabaseType}
						{...getCreateDialogProps("database")}
					/>
					<AddCompose
						projectName={workspace.project.name}
						environmentId={environmentId}
						{...getCreateDialogProps("compose")}
					/>
					<AddTemplate
						environmentId={environmentId}
						{...getCreateDialogProps("template")}
					/>
					<AddImport
						projectName={workspace.project.name}
						environmentId={environmentId}
						{...getCreateDialogProps("import")}
					/>
				</>
			)}
		</div>
	);
};
