"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Textarea } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import {
	ArrowRight,
	Box,
	Cable,
	CircuitBoard,
	Command,
	Database,
	ExternalLink,
	FolderInput,
	GlobeIcon,
	Grip,
	Loader2,
	Network,
	Play,
	PlusIcon,
	RefreshCw,
	Search,
	ServerIcon,
	Settings2,
	SquareTerminal,
	Table2,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ShowDeployments } from "@/components/dashboard/application/deployments/show-deployments";
import { ShowDomains } from "@/components/dashboard/application/domains/show-domains";
import { ShowPreviewDeployments } from "@/components/dashboard/application/preview-deployments/show-preview-deployments";
import { DeleteService } from "@/components/dashboard/compose/delete-service";
import { AddApplication } from "@/components/dashboard/project/add-application";
import { AddCompose } from "@/components/dashboard/project/add-compose";
import { AddDatabase } from "@/components/dashboard/project/add-database";
import { AddImport } from "@/components/dashboard/project/add-import";
import { AddTemplate } from "@/components/dashboard/project/add-template";
import { AdvancedEnvironmentSelector } from "@/components/dashboard/project/advanced-environment-selector";
import { EnvironmentVariables } from "@/components/dashboard/project/environment-variables";
import { ProjectEnvironment } from "@/components/dashboard/projects/project-environment";
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
import { cn } from "@/shared/utils";
import {
	getDefaultWorkspacePosition,
	getWorkspaceServiceKey,
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

type CommandGroup = "Services" | "Actions" | "System";

type CommandItem = {
	id: string;
	group: CommandGroup;
	label: string;
	detail: string;
	search: string;
	icon: ReactNode;
	run: () => void;
};

const deploymentServiceTypes = new Set<WorkspaceServiceType>([
	"application",
	"compose",
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

const getServiceSettingsHref = (
	projectId: string,
	environmentId: string,
	service: WorkspaceService,
) =>
	`/dashboard/project/${projectId}/environment/${environmentId}/services/${service.type}/${service.id}`;

export const EnvironmentCanvas = ({
	projectId,
	environmentId,
	onOpenListView,
}: {
	projectId: string;
	environmentId: string;
	onOpenListView?: () => void;
}) => {
	const router = useRouter();
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
	const [commandOpen, setCommandOpen] = useState(false);
	const [drawerTab, setDrawerTab] = useState<
		| "overview"
		| "variables"
		| "deployments"
		| "domains"
		| "previews"
		| "connections"
	>("overview");
	const [serviceEnvDraft, setServiceEnvDraft] = useState("");
	const [isArranging, setIsArranging] = useState(false);
	const dragState = useRef<DragState | null>(null);
	const suppressClick = useRef(false);

	const updateNode = api.workspace.updateNode.useMutation();
	const connect = api.workspace.connect.useMutation();
	const removeConnection = api.workspace.removeConnection.useMutation();
	const applyConnectionVariables =
		api.workspace.applyConnectionVariables.useMutation();
	const updateServiceEnv = api.workspace.updateServiceEnv.useMutation();

	const serviceActions = {
		application: {
			start: api.application.start.useMutation(),
			stop: api.application.stop.useMutation(),
			deploy: api.application.deploy.useMutation(),
		},
		compose: {
			start: api.compose.start.useMutation(),
			stop: api.compose.stop.useMutation(),
			deploy: api.compose.deploy.useMutation(),
		},
		postgres: {
			start: api.postgres.start.useMutation(),
			stop: api.postgres.stop.useMutation(),
			deploy: api.postgres.deploy.useMutation(),
		},
		mysql: {
			start: api.mysql.start.useMutation(),
			stop: api.mysql.stop.useMutation(),
			deploy: api.mysql.deploy.useMutation(),
		},
		mariadb: {
			start: api.mariadb.start.useMutation(),
			stop: api.mariadb.stop.useMutation(),
			deploy: api.mariadb.deploy.useMutation(),
		},
		redis: {
			start: api.redis.start.useMutation(),
			stop: api.redis.stop.useMutation(),
			deploy: api.redis.deploy.useMutation(),
		},
		mongo: {
			start: api.mongo.start.useMutation(),
			stop: api.mongo.stop.useMutation(),
			deploy: api.mongo.deploy.useMutation(),
		},
		libsql: {
			start: api.libsql.start.useMutation(),
			stop: api.libsql.stop.useMutation(),
			deploy: api.libsql.deploy.useMutation(),
		},
	};

	useEffect(() => {
		if (workspace?.nodes) setNodes(workspace.nodes);
	}, [workspace?.nodes]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setCommandOpen(true);
			}
			if (event.key === "Escape") {
				setConnectSource(null);
				setCommandOpen(false);
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

	const selectedServiceModel = selectedService
		? servicesByKey.get(
				getWorkspaceServiceKey(
					selectedService.serviceType,
					selectedService.serviceId,
				),
			)
		: null;
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
		{ value: "connections", label: "Connections" },
	];

	const serviceEnvQueryInput = selectedServiceModel
		? {
				environmentId,
				serviceId: selectedServiceModel.id,
				serviceType: selectedServiceModel.type,
			}
		: {
				environmentId,
				serviceId: "",
				serviceType: "application" as const,
			};
	const serviceEnvQuery = api.workspace.serviceEnv.useQuery(
		serviceEnvQueryInput,
		{
			enabled: !!selectedServiceModel && drawerTab === "variables",
		},
	);

	useEffect(() => {
		if (serviceEnvQuery.data) {
			setServiceEnvDraft(serviceEnvQuery.data.env);
		}
	}, [serviceEnvQuery.data]);

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
	}, [
		drawerTab,
		permissions?.deployment.read,
		permissions?.domain.read,
		selectedServiceModel,
	]);

	const filteredServices = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return services;
		return services.filter(
			(service) =>
				service.name.toLowerCase().includes(query) ||
				service.type.toLowerCase().includes(query) ||
				service.description?.toLowerCase().includes(query),
		);
	}, [services, searchQuery]);

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
	const selectedConnections = selectedService
		? connections.filter(
				(connection) =>
					(connection.sourceServiceId === selectedService.serviceId &&
						connection.sourceServiceType === selectedService.serviceType) ||
					(connection.targetServiceId === selectedService.serviceId &&
						connection.targetServiceType === selectedService.serviceType),
			)
		: [];

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

		if (connectSource) {
			if (
				connectSource.serviceId === service.id &&
				connectSource.serviceType === service.type
			) {
				setConnectSource(null);
				return;
			}

			try {
				await connect.mutateAsync({
					environmentId,
					source: connectSource,
					target: nextRef,
					label: "Private network",
				});
				await utils.workspace.byEnvironment.invalidate({ environmentId });
				toast.success("Services connected");
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

	const removeSelectedConnection = async (connection: WorkspaceConnection) => {
		await removeConnection.mutateAsync({
			connectionId: connection.connectionId,
		});
		await utils.workspace.byEnvironment.invalidate({ environmentId });
		toast.success("Connection removed");
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
					await utils.workspace.serviceEnv.invalidate(serviceEnvQueryInput);
					return `${result.entries.length} variable${result.entries.length === 1 ? "" : "s"} applied`;
				},
				error: (error) =>
					`Could not apply variables: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
		);
	};

	const saveServiceEnv = async () => {
		if (!selectedServiceModel) return;

		toast.promise(
			updateServiceEnv.mutateAsync({
				environmentId,
				serviceId: selectedServiceModel.id,
				serviceType: selectedServiceModel.type,
				env: serviceEnvDraft,
			}),
			{
				loading: "Saving variables...",
				success: async () => {
					await utils.workspace.serviceEnv.invalidate({
						environmentId,
						serviceId: selectedServiceModel.id,
						serviceType: selectedServiceModel.type,
					});
					return "Variables saved";
				},
				error: (error) =>
					`Could not save variables: ${error instanceof Error ? error.message : "Unknown error"}`,
			},
		);
	};

	const arrangeWorkspace = async () => {
		if (services.length === 0) return;

		const arrangedNodes = services.map((service, index) => ({
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

	const normalizedCommandQuery = searchQuery.trim().toLowerCase();
	const commandItems: CommandItem[] = [
		...services.flatMap((service) => {
			const baseSearch = [
				service.name,
				service.type,
				service.description,
				serviceTypeLabels[service.type],
				service.serverName,
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
				label: "Web server",
				detail: "Domains, TLS, cleanup, and proxy",
				path: "/dashboard/settings/server",
				search: "web server domain tls ssl proxy traefik cleanup",
				icon: <ServerIcon className="size-5 text-muted-foreground" />,
			},
			{
				id: "system:remote-servers",
				label: "Remote servers",
				detail: "Connected Docker hosts",
				path: "/dashboard/settings/servers",
				search: "remote servers docker hosts nodes machines",
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
	const commandGroups: CommandGroup[] = ["Services", "Actions", "System"];

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

						<Button
							variant={connectSource ? "primary" : "outline"}
							onClick={() => setConnectSource(null)}
						>
							<Cable className="size-4" />
							{connectSource ? "Cancel connection" : "Connections"}
						</Button>

						<Button variant="outline" onClick={() => setCommandOpen(true)}>
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
										Web server
									</DropdownMenu.Item>
								</Link>
								<Link href="/dashboard/settings/servers">
									<DropdownMenu.Item className="cursor-pointer">
										Remote servers
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

						{onOpenListView && (
							<Button variant="outline" onClick={onOpenListView}>
								<Table2 className="size-4" />
								List
							</Button>
						)}

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
							const service = servicesByKey.get(
								getWorkspaceServiceKey(node.serviceType, node.serviceId),
							);
							if (!service) return null;

							const visible = visibleServiceKeys.has(
								getWorkspaceServiceKey(service.type, service.id),
							);
							const isConnectSource =
								connectSource?.serviceId === service.id &&
								connectSource.serviceType === service.type;

							return (
								<button
									key={getWorkspaceServiceKey(node.serviceType, node.serviceId)}
									type="button"
									onPointerDown={(event) => onNodePointerDown(event, node)}
									onPointerMove={onNodePointerMove}
									onPointerUp={onNodePointerUp}
									onClick={() => selectOrConnectService(service)}
									className={cn(
										"absolute cursor-grab touch-none rounded-lg text-left outline-none transition",
										"focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
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
												<StatusTooltip status={service.status ?? undefined} />
											</div>

											<p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
												{service.description ||
													serviceTypeDescriptions[service.type]}
											</p>

											<div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
												<span className="flex min-w-0 items-center gap-1.5">
													<ServerIcon className="size-3 shrink-0" />
													<span className="truncate">
														{service.serverName || "Docklands host"}
													</span>
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
							onClick={() => setSelectedService(null)}
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
												<span>Host</span>
												<span className="truncate">
													{selectedServiceModel.serverName || "Docklands host"}
												</span>
											</div>
											<div className="flex items-center justify-between gap-4">
												<span>Type</span>
												<span>
													{serviceTypeLabels[selectedServiceModel.type]}
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
											setSelectedService(null);
											toast.info(
												"Select another service on the canvas to connect it",
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
									<DeleteService
										id={selectedServiceModel.id}
										type={selectedServiceModel.type}
									/>
								</div>
							</div>
						)}

						{drawerTab === "variables" && (
							<div className="space-y-3">
								{serviceEnvQuery.isPending ? (
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Loader2 className="size-4 animate-spin" />
										<span>Loading variables...</span>
									</div>
								) : (
									<>
										<Textarea
											value={serviceEnvDraft}
											onChange={(event) =>
												setServiceEnvDraft(event.target.value)
											}
											readOnly={!permissions?.envVars.write}
											placeholder="KEY=value"
											className="min-h-[22rem] resize-y font-mono text-sm"
										/>
										<div className="flex justify-end">
											<Button
												onClick={saveServiceEnv}
												loading={updateServiceEnv.isPending}
												disabled={!permissions?.envVars.write}
											>
												Save variables
											</Button>
										</div>
									</>
								)}
							</div>
						)}

						{drawerTab === "deployments" &&
							(selectedServiceModel.type === "application" ||
								selectedServiceModel.type === "compose") && (
								<ShowDeployments
									id={selectedServiceModel.id}
									type={selectedServiceModel.type}
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

						{drawerTab === "connections" && (
							<div className="space-y-3">
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
													<div className="min-w-0 text-sm">
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
													</div>
													<div className="flex shrink-0 items-center gap-1">
														<Button
															variant="outline"
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

			<Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
				<Dialog className="sm:max-w-2xl">
					<div>
						<Dialog.Title>Command Bar</Dialog.Title>
					</div>
					<div className="relative">
						<FocusShortcutInput
							autoFocus
							placeholder="Search services or actions..."
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
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
		</div>
	);
};
