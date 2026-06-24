import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import {
	AlertTriangle,
	BookIcon,
	ChevronDown,
	CircuitBoard,
	Database,
	FolderInput,
	GlobeIcon,
	LayoutGrid,
	List,
	MoreHorizontalIcon,
	Rocket,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { HandleWorkspace } from "@/components/dashboard/workspace/manage/handle-workspace";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { Dialog } from "@/components/shared/dialog";
import { SectionCard } from "@/components/shared/section-card";
import { toast } from "@/components/shared/toast";
import { workspaceEnvironmentPath } from "@/shared/routes";
import { cn } from "@/shared/utils";

const logger = createClientLogger("workspace");

type ServiceStatus = "idle" | "running" | "done" | "error";

type Workspace = RouterOutputs["workspaces"]["all"][number];
type WorkspaceEnvironment = Workspace["environments"][number];

type CardService = {
	id: string;
	kind: "application" | "compose" | "database";
	engine?: string;
	status: ServiceStatus;
};

// Flatten every service across a workspace's environments into one icon-ready
// list, so a workspace card can preview its services the way the canvas does.
function collectServices(workspace: Workspace): CardService[] {
	const services: CardService[] = [];
	for (const environment of workspace.environments) {
		for (const app of environment.applications) {
			services.push({
				id: `app-${app.applicationId}`,
				kind: "application",
				status: (app.applicationStatus ?? "idle") as ServiceStatus,
			});
		}
		for (const comp of environment.compose) {
			services.push({
				id: `compose-${comp.composeId}`,
				kind: "compose",
				status: (comp.composeStatus ?? "idle") as ServiceStatus,
			});
		}
		for (const db of environment.database) {
			services.push({
				id: `db-${db.databaseId}`,
				kind: "database",
				engine: db.engine,
				status: (db.applicationStatus ?? "idle") as ServiceStatus,
			});
		}
	}
	return services;
}

function pickEnvironment(
	workspace: Workspace,
): WorkspaceEnvironment | undefined {
	return (
		workspace.environments.find((environment) => environment.isDefault) ||
		workspace.environments[0]
	);
}

const serviceIconClass = "size-5 text-kumo-subtle";

function ServiceTileIcon({ service }: { service: CardService }) {
	if (service.kind === "compose")
		return <CircuitBoard className={serviceIconClass} />;
	if (service.kind === "application")
		return <GlobeIcon className={serviceIconClass} />;

	switch (service.engine) {
		case "postgres":
			return <PostgresqlIcon className={serviceIconClass} />;
		case "mysql":
			return <MysqlIcon className={serviceIconClass} />;
		case "mariadb":
			return <MariadbIcon className={serviceIconClass} />;
		case "mongo":
			return <MongodbIcon className={serviceIconClass} />;
		case "redis":
			return <RedisIcon className={serviceIconClass} />;
		case "libsql":
			return <LibsqlIcon className={serviceIconClass} />;
		default:
			return <Database className={serviceIconClass} />;
	}
}

const MAX_PREVIEW_ICONS = 7;

// The dotted canvas backdrop, matching the project-canvas grid texture.
const dottedBackground = {
	backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
	backgroundSize: "16px 16px",
} as const;

function ServicePreview({ services }: { services: CardService[] }) {
	const shown = services.slice(0, MAX_PREVIEW_ICONS);
	const overflow = services.length - shown.length;

	return (
		<div
			className="relative flex min-h-[176px] flex-1 items-center justify-center overflow-hidden rounded-lg border bg-kumo-fill/10 px-4 py-6 text-kumo-line/50"
			style={dottedBackground}
		>
			{services.length === 0 ? (
				<div className="flex flex-col items-center gap-2 text-kumo-subtle">
					<BookIcon className="size-6 opacity-50" />
					<span className="text-xs">No services yet</span>
				</div>
			) : (
				<div className="flex max-w-[14rem] flex-wrap items-center justify-center gap-2.5">
					{shown.map((service) => (
						<span
							key={service.id}
							className="flex size-11 items-center justify-center rounded-lg border bg-kumo-canvas"
						>
							<ServiceTileIcon service={service} />
						</span>
					))}
					{overflow > 0 && (
						<span className="flex size-11 items-center justify-center rounded-lg border bg-kumo-canvas text-xs font-medium text-kumo-subtle">
							+{overflow}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

function statusDotClass(online: number, total: number, hasError: boolean) {
	if (total === 0) return "bg-kumo-subtle/40";
	if (hasError) return "bg-kumo-danger";
	if (online === 0) return "bg-kumo-subtle/40";
	if (online === total) return "bg-kumo-success";
	return "bg-kumo-warning";
}

function ProjectFooter({
	environmentName,
	online,
	total,
	hasError,
}: {
	environmentName: string;
	online: number;
	total: number;
	hasError: boolean;
}) {
	return (
		<div className="flex items-center gap-2 px-5 py-3 text-xs text-kumo-subtle">
			<span
				className={cn(
					"size-2 shrink-0 rounded-full",
					statusDotClass(online, total, hasError),
				)}
				aria-hidden
			/>
			<span className="truncate">{environmentName}</span>
			<span aria-hidden>·</span>
			<span className="whitespace-nowrap">
				{online}/{total} {total === 1 ? "service" : "services"} online
			</span>
		</div>
	);
}

function FirstRunWorkspacePanel({
	canCreateWorkspaces,
}: {
	canCreateWorkspaces: boolean;
}) {
	return (
		<div className="flex min-h-[480px] items-center justify-center px-6 py-12">
			<div className="flex w-full max-w-3xl flex-col items-center text-center">
				<span className="flex size-12 items-center justify-center rounded-lg border bg-kumo-fill/30">
					<FolderInput className="size-5 text-kumo-subtle" />
				</span>
				<h2 className="mt-5 text-2xl font-semibold tracking-tight">
					Start from a workspace canvas
				</h2>
				<p className="mt-2 max-w-xl text-sm text-kumo-subtle">
					Create the first workspace, then drop services onto one environment
					canvas.
				</p>
				{canCreateWorkspaces && (
					<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
						<HandleWorkspace />
					</div>
				)}

				<div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
					<div className="flex min-h-[112px] flex-col gap-3 rounded-lg border bg-kumo-fill/20 p-4 text-left">
						<FolderInput className="size-4 text-kumo-subtle" />
						<div className="flex flex-col gap-1">
							<span className="text-sm font-medium">Workspace</span>
							<span className="text-xs text-kumo-subtle">
								Name the system boundary.
							</span>
						</div>
					</div>
					<div className="flex min-h-[112px] flex-col gap-3 rounded-lg border bg-kumo-fill/20 p-4 text-left">
						<BookIcon className="size-4 text-kumo-subtle" />
						<div className="flex flex-col gap-1">
							<span className="text-sm font-medium">Service</span>
							<span className="text-xs text-kumo-subtle">
								Add Git, image, compose, or data.
							</span>
						</div>
					</div>
					<div className="flex min-h-[112px] flex-col gap-3 rounded-lg border bg-kumo-fill/20 p-4 text-left">
						<Rocket className="size-4 text-kumo-subtle" />
						<div className="flex flex-col gap-1">
							<span className="text-sm font-medium">Runtime</span>
							<span className="text-xs text-kumo-subtle">
								Deploy on this VM.
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Per-workspace management (rename/tags/delete). It hangs off each card/row so
// the overview stays the single workspace surface.
function WorkspaceRowActions({
	workspaceId,
	serviceCount,
}: {
	workspaceId: string;
	serviceCount: number;
}) {
	const utils = api.useUtils();
	const { permissions } = usePermissions();
	const { mutateAsync } = api.workspaces.remove.useMutation();
	const emptyServices = serviceCount === 0;

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					(
						<Button
							aria-label="Workspace actions"
							variant="ghost"
							shape="square"
						>
							<MoreHorizontalIcon className="size-5" />
						</Button>
					) as never
				}
			/>
			<DropdownMenu.Content
				className="w-[200px] space-y-2 overflow-y-auto max-h-[280px]"
				onClick={(e) => e.stopPropagation()}
			>
				<DropdownMenu.Group>
					<DropdownMenu.Label className="font-normal">
						Actions
					</DropdownMenu.Label>
				</DropdownMenu.Group>
				<div onClick={(e) => e.stopPropagation()}>
					<HandleWorkspace workspaceId={workspaceId} />
				</div>
				{permissions?.workspace.delete && (
					<div onClick={(e) => e.stopPropagation()}>
						<Dialog.Root role="alertdialog">
							<Dialog.Trigger className="w-full">
								<DropdownMenu.Item
									className="w-full cursor-pointer space-x-3"
									onSelect={(e) => e.preventDefault()}
								>
									<TrashIcon className="size-4" />
									<span>Delete</span>
								</DropdownMenu.Item>
							</Dialog.Trigger>
							<Dialog>
								<Dialog.Header>
									<Dialog.Title>Delete workspace?</Dialog.Title>
									{!emptyServices ? (
										<div className="flex flex-row gap-4 rounded-lg bg-kumo-warning-tint p-2">
											<AlertTriangle className="text-kumo-warning" />
											<span className="text-sm text-kumo-warning">
												Delete services first.
											</span>
										</div>
									) : (
										<Dialog.Description>
											This action cannot be undone
										</Dialog.Description>
									)}
								</Dialog.Header>
								<Dialog.Footer>
									<Dialog.Close>Cancel</Dialog.Close>
									<Dialog.Close
										disabled={!emptyServices}
										onClick={async () => {
											try {
												await mutateAsync({ workspaceId });
												toast.success("Workspace deleted");
											} catch (err) {
												logger.error("Error deleting workspace", err);
												toast.error("Error deleting this workspace");
											} finally {
												await utils.workspaces.all.invalidate();
											}
										}}
									>
										Delete
									</Dialog.Close>
								</Dialog.Footer>
							</Dialog>
						</Dialog.Root>
					</div>
				)}
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}

type SortKey = "recent" | "name";
type ViewMode = "grid" | "list";

const sortOptions: { value: SortKey; label: string }[] = [
	{ value: "recent", label: "Recent Activity" },
	{ value: "name", label: "Name" },
];

type ProjectEntry = {
	workspace: Workspace;
	environment: WorkspaceEnvironment | undefined;
	services: CardService[];
	online: number;
	total: number;
	hasError: boolean;
};

function ProjectCard({ entry }: { entry: ProjectEntry }) {
	const { workspace, environment, services, online, total, hasError } = entry;
	const href = environment
		? workspaceEnvironmentPath({
				workspaceId: workspace.workspaceId,
				environmentId: environment.environmentId,
			})
		: null;

	const body = (
		<>
			<div className="flex items-start gap-2 px-5 pt-4 pb-3">
				<h3 className="min-w-0 flex-1 truncate pr-1 text-sm font-semibold">
					{workspace.name}
				</h3>
			</div>
			<div className="flex flex-1 flex-col px-5 pb-2">
				<ServicePreview services={services} />
			</div>
			<ProjectFooter
				environmentName={environment?.name ?? "No environment"}
				online={online}
				total={total}
				hasError={hasError}
			/>
		</>
	);

	return (
		<div className="group relative flex flex-col overflow-hidden rounded-xl border bg-kumo-canvas transition-colors hover:border-kumo-line">
			{href ? (
				<Link href={href} className="flex flex-1 flex-col">
					{body}
				</Link>
			) : (
				<div className="flex flex-1 flex-col">{body}</div>
			)}
			<div className="absolute right-2 top-2">
				<WorkspaceRowActions
					workspaceId={workspace.workspaceId}
					serviceCount={total}
				/>
			</div>
		</div>
	);
}

function ProjectRow({ entry }: { entry: ProjectEntry }) {
	const { workspace, environment, online, total, hasError } = entry;
	const href = environment
		? workspaceEnvironmentPath({
				workspaceId: workspace.workspaceId,
				environmentId: environment.environmentId,
			})
		: null;

	const body = (
		<>
			<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/30">
				<BookIcon className="size-4 text-kumo-subtle" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm">{workspace.name}</span>
				<span className="flex items-center gap-2 truncate text-xs text-kumo-subtle">
					<span
						className={cn(
							"size-2 shrink-0 rounded-full",
							statusDotClass(online, total, hasError),
						)}
						aria-hidden
					/>
					{environment?.name ?? "No environment"} · {online}/{total}{" "}
					{total === 1 ? "service" : "services"} online
				</span>
			</div>
		</>
	);

	return (
		<li className="flex items-center gap-2 rounded-lg border bg-kumo-canvas pr-2 transition-colors hover:border-kumo-line">
			{href ? (
				<Link
					href={href}
					className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3"
				>
					{body}
				</Link>
			) : (
				<div className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3">
					{body}
				</div>
			)}
			<WorkspaceRowActions
				workspaceId={workspace.workspaceId}
				serviceCount={total}
			/>
		</li>
	);
}

export const WorkspaceOverview = () => {
	const { data: workspaces } = api.workspaces.all.useQuery();
	const { permissions } = usePermissions();
	const canCreateWorkspaces = !!permissions?.workspace.create;

	const [sortBy, setSortBy] = useState<SortKey>("recent");
	const [view, setView] = useState<ViewMode>("grid");

	const projects = useMemo<ProjectEntry[]>(() => {
		if (!workspaces) return [];

		const entries = workspaces.map((workspace) => {
			const services = collectServices(workspace);
			const online = services.filter((s) => s.status === "running").length;
			const hasError = services.some((s) => s.status === "error");
			return {
				workspace,
				environment: pickEnvironment(workspace),
				services,
				online,
				total: services.length,
				hasError,
			};
		});

		entries.sort((a, b) => {
			if (sortBy === "name") {
				return a.workspace.name.localeCompare(b.workspace.name);
			}
			return (
				new Date(b.workspace.createdAt).getTime() -
				new Date(a.workspace.createdAt).getTime()
			);
		});

		return entries;
	}, [workspaces, sortBy]);

	const isLoading = workspaces === undefined;
	const showFirstRun = !isLoading && projects.length === 0;
	const sortLabel =
		sortOptions.find((option) => option.value === sortBy)?.label ?? "";

	return (
		<SectionCard
			icon={LayoutGrid}
			title="Workspaces"
			description="Your project workspaces and the services running in each."
			actions={canCreateWorkspaces ? <HandleWorkspace /> : undefined}
			contentClassName="space-y-5"
		>
			{showFirstRun ? (
				<FirstRunWorkspacePanel canCreateWorkspaces={canCreateWorkspaces} />
			) : (
				<>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-4 text-sm text-kumo-subtle">
							<span className="flex items-center gap-2">
								<LayoutGrid className="size-4" />
								{isLoading
									? "Loading…"
									: `${projects.length} ${projects.length === 1 ? "Workspace" : "Workspaces"}`}
							</span>
							<span className="hidden h-4 w-px bg-kumo-hairline sm:block" />
							<DropdownMenu>
								<DropdownMenu.Trigger
									render={
										(
											<Button variant="ghost" className="gap-1.5">
												<span className="text-kumo-subtle">Sort By:</span>
												<span className="font-medium text-kumo-default">
													{sortLabel}
												</span>
												<ChevronDown className="size-4" />
											</Button>
										) as never
									}
								/>
								<DropdownMenu.Content className="w-[180px]">
									{sortOptions.map((option) => (
										<DropdownMenu.Item
											key={option.value}
											className={cn(
												"cursor-pointer",
												option.value === sortBy && "font-medium",
											)}
											onSelect={() => setSortBy(option.value)}
										>
											{option.label}
										</DropdownMenu.Item>
									))}
								</DropdownMenu.Content>
							</DropdownMenu>
						</div>

						<div className="flex items-center gap-1">
							<Button
								aria-label="Grid view"
								variant={view === "grid" ? "secondary" : "ghost"}
								shape="square"
								onClick={() => setView("grid")}
							>
								<LayoutGrid className="size-4" />
							</Button>
							<Button
								aria-label="List view"
								variant={view === "list" ? "secondary" : "ghost"}
								shape="square"
								onClick={() => setView("list")}
							>
								<List className="size-4" />
							</Button>
						</div>
					</div>

					{isLoading ? (
						<div className="flex min-h-[40vh] items-center justify-center text-sm text-kumo-subtle">
							Loading workspaces…
						</div>
					) : view === "grid" ? (
						<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
							{projects.map((entry) => (
								<ProjectCard key={entry.workspace.workspaceId} entry={entry} />
							))}
						</div>
					) : (
						<ul className="flex flex-col gap-2">
							{projects.map((entry) => (
								<ProjectRow key={entry.workspace.workspaceId} entry={entry} />
							))}
						</ul>
					)}
				</>
			)}
		</SectionCard>
	);
};
