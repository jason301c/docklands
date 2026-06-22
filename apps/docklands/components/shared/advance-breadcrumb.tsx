import { Button } from "@cloudflare/kumo/components/button";
import { Combobox } from "@cloudflare/kumo/components/combobox";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { SidebarTrigger } from "@cloudflare/kumo/components/sidebar";
import {
	Check,
	ChevronDown,
	ChevronRight,
	CircuitBoard,
	FolderInput,
	GlobeIcon,
	X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { ScrollArea } from "@/components/shared/scroll-area";
import { Separator } from "@/components/shared/separator";
import type { ServiceType } from "@/server/core/db/schema";
import {
	workspaceEnvironmentPath,
	workspaceServicePath,
} from "@/shared/routes";

const Command = Combobox;
const CommandInput = Combobox.TriggerInput;
const CommandList = Combobox.List;
const CommandGroup = Combobox.Group;
const CommandItem = Combobox.Item;
const CommandEmpty = Combobox.Empty;

type WorkspaceItem = RouterOutputs["workspaces"]["all"][number];
type WorkspaceEnvironment = WorkspaceItem["environments"][number];
type EnvironmentDetails = RouterOutputs["environment"]["one"];

type ServiceItem = {
	id: string;
	name: string;
	type: ServiceType;
};

type NamedService = {
	name: string;
};

type EnvironmentServiceCollections = {
	applications: (NamedService & { applicationId: string })[];
	compose: (NamedService & { composeId: string })[];
	postgres: (NamedService & { postgresId: string })[];
	mysql: (NamedService & { mysqlId: string })[];
	mariadb: (NamedService & { mariadbId: string })[];
	redis: (NamedService & { redisId: string })[];
	mongo: (NamedService & { mongoId: string })[];
	libsql: (NamedService & { libsqlId: string })[];
};

type ServiceCollections = Pick<
	WorkspaceEnvironment,
	| "applications"
	| "compose"
	| "postgres"
	| "mysql"
	| "mariadb"
	| "redis"
	| "mongo"
	| "libsql"
>;

const SERVICE_COLLECTION_KEYS = [
	"applications",
	"compose",
	"postgres",
	"mysql",
	"mariadb",
	"redis",
	"mongo",
	"libsql",
] as const satisfies ReadonlyArray<keyof ServiceCollections>;

const SERVICE_QUERY_KEYS = [
	"applicationId",
	"composeId",
	"postgresId",
	"mysqlId",
	"mariadbId",
	"redisId",
	"mongoId",
	"libsqlId",
] as const;

const SERVICE_ICONS: Record<
	ServiceType,
	ComponentType<{ className?: string }>
> = {
	application: GlobeIcon,
	compose: CircuitBoard,
	postgres: PostgresqlIcon,
	mysql: MysqlIcon,
	mariadb: MariadbIcon,
	redis: RedisIcon,
	mongo: MongodbIcon,
	libsql: LibsqlIcon,
};

const getStringQueryParam = (value: string | string[] | undefined) =>
	typeof value === "string" ? value : null;

const includesSearch = (value: string | null | undefined, search: string) =>
	value?.toLowerCase().includes(search.toLowerCase()) ?? false;

const getServiceIcon = (type: ServiceType, className = "size-4") => {
	const Icon = SERVICE_ICONS[type];
	return <Icon className={className} />;
};

const countEnvironmentServices = (environment: ServiceCollections): number =>
	SERVICE_COLLECTION_KEYS.reduce(
		(total, key) => total + environment[key].length,
		0,
	);

const mapServices = <T extends { name: string }>(
	items: readonly T[],
	getId: (item: T) => string,
	type: ServiceType,
): ServiceItem[] =>
	items.map((item) => ({
		id: getId(item),
		name: item.name,
		type,
	}));

const extractServicesFromEnvironment = (
	environment: EnvironmentDetails | null | undefined,
): ServiceItem[] => {
	if (!environment) return [];

	const servicesByType =
		environment as unknown as EnvironmentServiceCollections;

	return [
		...mapServices(
			servicesByType.applications,
			(item) => item.applicationId,
			"application",
		),
		...mapServices(servicesByType.compose, (item) => item.composeId, "compose"),
		...mapServices(
			servicesByType.postgres,
			(item) => item.postgresId,
			"postgres",
		),
		...mapServices(servicesByType.mysql, (item) => item.mysqlId, "mysql"),
		...mapServices(servicesByType.mariadb, (item) => item.mariadbId, "mariadb"),
		...mapServices(servicesByType.redis, (item) => item.redisId, "redis"),
		...mapServices(servicesByType.mongo, (item) => item.mongoId, "mongo"),
		...mapServices(servicesByType.libsql, (item) => item.libsqlId, "libsql"),
	];
};

const getTargetEnvironmentId = (
	workspace: WorkspaceItem,
	selectedEnvironmentId?: string,
) => {
	if (selectedEnvironmentId) return selectedEnvironmentId;

	const productionEnvironment = workspace.environments.find(
		(environment) => environment.name === "production",
	);

	return (
		productionEnvironment?.environmentId ??
		workspace.environments[0]?.environmentId
	);
};

export const AdvanceBreadcrumb = () => {
	const router = useRouter();
	const params = useParams<Record<string, string | string[] | undefined>>();

	// Read IDs from URL (dynamic route segments)
	const workspaceId = getStringQueryParam(params.workspaceId);
	const environmentId = getStringQueryParam(params.environmentId);
	const serviceId =
		getStringQueryParam(params.serviceId) ??
		SERVICE_QUERY_KEYS.map((key) => getStringQueryParam(params[key])).find(
			(value): value is string => !!value,
		) ??
		null;

	const [workspaceOpen, setWorkspaceOpen] = useState(false);
	const [serviceOpen, setServiceOpen] = useState(false);
	const [environmentOpen, setEnvironmentOpen] = useState(false);
	const [workspaceSearch, setWorkspaceSearch] = useState("");
	const [serviceSearch, setServiceSearch] = useState("");
	const [environmentSearch, setEnvironmentSearch] = useState("");
	const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(
		null,
	);

	// Fetch all workspaces
	const { data: allWorkspaces } = api.workspaces.all.useQuery();

	// Fetch current workspace data
	const { data: currentWorkspace } = api.workspaces.one.useQuery(
		{ workspaceId: workspaceId ?? "" },
		{ enabled: !!workspaceId },
	);

	// Fetch current environment
	const { data: currentEnvironment } = api.environment.one.useQuery(
		{ environmentId: environmentId ?? "" },
		{ enabled: !!environmentId },
	);

	// Fetch environments for current workspace
	const { data: workspaceEnvironments } =
		api.environment.byWorkspaceId.useQuery(
			{ workspaceId: workspaceId ?? "" },
			{ enabled: !!workspaceId },
		);

	// Close dropdowns on escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setWorkspaceOpen(false);
				setServiceOpen(false);
				setEnvironmentOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const services = useMemo(
		() => extractServicesFromEnvironment(currentEnvironment),
		[currentEnvironment],
	);

	const currentService = useMemo(
		() => services.find((service) => service.id === serviceId),
		[serviceId, services],
	);

	// Navigate to workspace's default environment
	const handleWorkspaceSelect = (
		selectedWorkspaceId: string,
		selectedEnvironmentId?: string,
	) => {
		const workspace = allWorkspaces?.find(
			(p) => p.workspaceId === selectedWorkspaceId,
		);
		if (workspace) {
			const targetEnvironmentId = getTargetEnvironmentId(
				workspace,
				selectedEnvironmentId,
			);

			if (targetEnvironmentId) {
				router.push(
					workspaceEnvironmentPath({
						workspaceId: selectedWorkspaceId,
						environmentId: targetEnvironmentId,
					}),
				);
			}
		}
		setWorkspaceOpen(false);
		setExpandedWorkspaceId(null);
	};

	// Navigate to environment
	const handleEnvironmentSelect = (envId: string) => {
		if (!workspaceId) return;

		router.push(
			workspaceEnvironmentPath({
				workspaceId: workspaceId,
				environmentId: envId,
			}),
		);
		setEnvironmentOpen(false);
	};

	// Navigate to service
	const handleServiceSelect = (service: ServiceItem) => {
		if (!workspaceId || !environmentId) return;

		router.push(
			workspaceServicePath({
				workspaceId: workspaceId,
				environmentId,
				serviceType: service.type,
				serviceId: service.id,
			}),
		);
		setServiceOpen(false);
	};

	const filteredWorkspaces = useMemo(
		() =>
			(allWorkspaces ?? []).filter(
				(workspace) =>
					includesSearch(workspace.name, workspaceSearch) ||
					includesSearch(workspace.description, workspaceSearch),
			),
		[allWorkspaces, workspaceSearch],
	);

	const filteredServices = useMemo(
		() =>
			services.filter((service) => includesSearch(service.name, serviceSearch)),
		[serviceSearch, services],
	);

	const filteredEnvironments = useMemo(
		() =>
			(workspaceEnvironments ?? []).filter((environment) =>
				includesSearch(environment.name, environmentSearch),
			),
		[environmentSearch, workspaceEnvironments],
	);

	// If we're just on the workspaces page, show simple breadcrumb
	if (!workspaceId) {
		return (
			<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
				<div className="flex items-center gap-2">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<div className="flex items-center gap-2">
						<FolderInput className="size-4 text-muted-foreground" />
						<span className="font-medium">Workspaces</span>
					</div>
				</div>
			</header>
		);
	}

	return (
		<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
			<div className="flex items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 h-4" />

				<div className="flex items-center">
					{/* Workspace selector */}
					<Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								aria-expanded={workspaceOpen}
								className="h-auto px-2 py-1.5 hover:bg-accent gap-2"
							>
								<FolderInput className="size-4 text-muted-foreground" />
								<span className="font-medium max-w-[50px] md:max-w-[150px] truncate">
									{currentWorkspace?.name || "Select workspace"}
								</span>
								<ChevronDown className="size-4 text-muted-foreground" />
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className="w-[380px] p-0"
							align="start"
							sideOffset={8}
						>
							<Command items={[]}>
								<div className="relative">
									<CommandInput
										placeholder="Find workspace..."
										value={workspaceSearch}
										onChange={(event) => setWorkspaceSearch(event.target.value)}
										className="w-full focus-visible:ring-0"
									/>
									<kbd className="pointer-events-none h-5 absolute right-2 top-1/2 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 flex">
										Esc
									</kbd>
								</div>
								<CommandList>
									<CommandEmpty>No workspaces found.</CommandEmpty>
									<CommandGroup>
										<ScrollArea className="h-[300px]">
											{filteredWorkspaces.map((workspace) => {
												const totalServices = workspace.environments.reduce(
													(total, env) => total + countEnvironmentServices(env),
													0,
												);
												const isSelected =
													workspace.workspaceId === workspaceId;
												const isExpanded =
													expandedWorkspaceId === workspace.workspaceId;

												return (
													<div key={workspace.workspaceId}>
														<CommandItem
															value={workspace.workspaceId}
															onSelect={() => {
																if (workspace.environments.length > 1) {
																	setExpandedWorkspaceId(
																		isExpanded ? null : workspace.workspaceId,
																	);
																} else {
																	handleWorkspaceSelect(workspace.workspaceId);
																}
															}}
															className="flex items-center justify-between py-3 px-2 cursor-pointer"
														>
															<div className="flex items-center gap-3">
																<div className="flex items-center justify-center size-8 rounded-md bg-muted text-xs font-semibold uppercase">
																	{workspace.name.slice(0, 2)}
																</div>
																<div className="flex flex-col">
																	<span className="font-medium">
																		{workspace.name}
																	</span>
																	<span className="text-muted-foreground">
																		{workspace.environments.length} env
																		{workspace.environments.length !== 1
																			? "s"
																			: ""}{" "}
																		· {totalServices} service
																		{totalServices !== 1 ? "s" : ""}
																	</span>
																</div>
															</div>
															<div className="flex items-center gap-2">
																{isSelected && (
																	<Check className="size-4 text-primary" />
																)}
																{workspace.environments.length > 1 && (
																	<ChevronRight
																		className={`size-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
																	/>
																)}
															</div>
														</CommandItem>

														{/* Expanded environments */}
														{isExpanded && (
															<div className="ml-11 border-l pl-3 py-1 space-y-1">
																{workspace.environments.map((env) => {
																	const envServices =
																		countEnvironmentServices(env);
																	const isEnvSelected =
																		env.environmentId === environmentId;

																	return (
																		<CommandItem
																			key={env.environmentId}
																			value={env.environmentId}
																			onSelect={() =>
																				handleWorkspaceSelect(
																					workspace.workspaceId,
																					env.environmentId,
																				)
																			}
																			className="flex items-center justify-between py-2 px-2 cursor-pointer text-sm"
																		>
																			<div className="flex items-center gap-2">
																				<p className="text-xs">{env.name}</p>
																				<span className="text-xs text-muted-foreground">
																					{envServices} service
																					{envServices !== 1 ? "s" : ""}
																				</span>
																			</div>
																			{isEnvSelected && (
																				<Check className="size-3 text-primary" />
																			)}
																		</CommandItem>
																	);
																})}
															</div>
														)}
													</div>
												);
											})}
										</ScrollArea>
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>

					{/* Environment Selector */}
					{workspaceEnvironments && workspaceEnvironments.length > 1 && (
						<Popover open={environmentOpen} onOpenChange={setEnvironmentOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="ghost"
									aria-expanded={environmentOpen}
									className="h-auto px-2 py-1.5 hover:bg-accent gap-2"
								>
									<span className="font-medium max-w-[50px] md:max-w-[150px] truncate">
										{currentEnvironment?.name || "production"}
									</span>
									<ChevronDown className="size-4 text-muted-foreground" />
								</Button>
							</PopoverTrigger>
							<PopoverContent
								className="w-[350px] p-0"
								align="start"
								sideOffset={8}
							>
								<Command items={[]}>
									<div className="relative">
										<CommandInput
											placeholder="Find Environment..."
											value={environmentSearch}
											onChange={(event) =>
												setEnvironmentSearch(event.target.value)
											}
											className="w-full focus-visible:ring-0"
										/>
										<kbd className="pointer-events-none h-5 absolute right-2 top-1/2 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 flex">
											Esc
										</kbd>
									</div>
									<CommandList>
										<CommandEmpty>No environments found.</CommandEmpty>
										<CommandGroup>
											<ScrollArea className="h-[300px]">
												{filteredEnvironments.map((env) => {
													const isSelected =
														env.environmentId === environmentId;
													return (
														<CommandItem
															key={env.environmentId}
															value={env.environmentId}
															onSelect={() =>
																handleEnvironmentSelect(env.environmentId)
															}
															className="flex items-center justify-between py-2 cursor-pointer"
														>
															<span className="font-medium">{env.name}</span>
															{isSelected && (
																<Check className="size-4 text-primary" />
															)}
														</CommandItem>
													);
												})}
											</ScrollArea>
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					)}

					{workspaceEnvironments && workspaceEnvironments.length === 1 && (
						<p className="text-sm font-normal ml-1 max-w-[50px] md:max-w-[150px] truncate">
							{currentEnvironment?.name || "production"}
						</p>
					)}

					{/* Service Selector - only show when viewing a service */}
					{serviceId && currentService && (
						<>
							<Separator orientation="vertical" className="mx-2 h-6" />

							<Popover open={serviceOpen} onOpenChange={setServiceOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="ghost"
										aria-expanded={serviceOpen}
										className="h-auto px-2 py-1.5 hover:bg-accent gap-2"
									>
										{getServiceIcon(currentService.type)}
										<span className="font-medium max-w-[50px] md:max-w-[150px] truncate">
											{currentService.name}
										</span>
										<ChevronDown className="size-4 text-muted-foreground" />
									</Button>
								</PopoverTrigger>
								<PopoverContent
									className="w-[350px] p-0"
									align="start"
									sideOffset={8}
								>
									<Command items={[]}>
										<div className="relative">
											<CommandInput
												placeholder="Find Service..."
												value={serviceSearch}
												onChange={(event) =>
													setServiceSearch(event.target.value)
												}
												className="w-full focus-visible:ring-0"
											/>
											<kbd className="pointer-events-none h-5 select-none absolute right-2 top-1/2 -translate-y-1/2 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 flex">
												Esc
											</kbd>
										</div>
										<CommandList>
											<CommandEmpty>No services found.</CommandEmpty>
											<CommandGroup>
												<ScrollArea className="h-[300px]">
													{filteredServices.map((service) => {
														const isSelected = service.id === serviceId;
														return (
															<CommandItem
																key={service.id}
																value={service.id}
																onSelect={() => handleServiceSelect(service)}
																className="flex items-center justify-between py-2 cursor-pointer"
															>
																<div className="flex items-center gap-3">
																	<div className="flex items-center justify-center size-8 rounded-md bg-muted">
																		{getServiceIcon(service.type)}
																	</div>
																	<div className="flex flex-col">
																		<span className="font-medium">
																			{service.name}
																		</span>
																		<span className="text-xs text-muted-foreground capitalize">
																			{service.type}
																		</span>
																	</div>
																</div>
																{isSelected && (
																	<Check className="size-4 text-primary" />
																)}
															</CommandItem>
														);
													})}
												</ScrollArea>
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>

							{/* Close button to go back to environment */}
							<Button
								aria-label="Back to environment"
								variant="ghost"
								shape="square"
								className="size-7 ml-1 hidden md:flex"
								onClick={() => {
									if (!workspaceId || !environmentId) return;

									router.push(
										workspaceEnvironmentPath({
											workspaceId: workspaceId,
											environmentId,
										}),
									);
								}}
							>
								<X className="size-4 text-muted-foreground" />
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
};
