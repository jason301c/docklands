import { Button } from "@cloudflare/kumo/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import {
	Ban,
	BookIcon,
	ChevronDown,
	CircuitBoard,
	Database,
	FolderInput,
	GlobeIcon,
	LayoutGrid,
	List,
	Pencil,
	Rocket,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { HandleWorkspace } from "@/components/dashboard/workspace/manage/handle-workspace";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { DropdownMenu } from "@/components/shared/dropdown";
import { SectionCard } from "@/components/shared/section-card";
import { workspaceEnvironmentPath } from "@/shared/routes";
import { cn } from "@/shared/utils";

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

function servicesLabel(online: number, total: number) {
	if (total === 0) return "No services";
	return `${online}/${total} ${total === 1 ? "service" : "services"} online`;
}

// Preset accent colors a user can apply to a workspace card.
const WORKSPACE_COLORS = [
	{ name: "Red", value: "#ef4444" },
	{ name: "Orange", value: "#f97316" },
	{ name: "Amber", value: "#f59e0b" },
	{ name: "Lime", value: "#84cc16" },
	{ name: "Green", value: "#22c55e" },
	{ name: "Teal", value: "#14b8a6" },
	{ name: "Sky", value: "#0ea5e9" },
	{ name: "Blue", value: "#3b82f6" },
	{ name: "Violet", value: "#8b5cf6" },
	{ name: "Pink", value: "#ec4899" },
] as const;

// A workspace's accent color shows as a crisp stripe down the card/row's left
// edge — a clean color cue that keeps the card content fully neutral.
function AccentStripe({ color }: { color: string | null | undefined }) {
	if (!color) return null;
	return (
		<span
			aria-hidden
			className="absolute inset-y-0 left-0 w-1"
			style={{ backgroundColor: color }}
		/>
	);
}

// Inline workspace rename state, shared by the grid card and the list row so the
// title field (left) and the rename pencil (right) stay in sync.
function useWorkspaceRename(workspace: Workspace) {
	const utils = api.useUtils();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(workspace.name);

	const mutation = api.workspaces.update.useMutation(
		crudMutationOptions({
			successMessage: "Workspace renamed",
			errorMessage: "Failed to rename workspace",
			loggerScope: "workspace",
			invalidate: () => utils.workspaces.all.invalidate(),
			onSuccess: () => setEditing(false),
		}),
	);

	const start = () => {
		setValue(workspace.name);
		setEditing(true);
	};
	const cancel = () => {
		setEditing(false);
		setValue(workspace.name);
	};
	const submit = () => {
		const name = value.trim();
		if (!name || name === workspace.name) {
			cancel();
			return;
		}
		mutation.mutate({ workspaceId: workspace.workspaceId, name });
	};

	return {
		editing,
		value,
		setValue,
		start,
		cancel,
		submit,
		isPending: mutation.isPending,
	};
}

type WorkspaceRename = ReturnType<typeof useWorkspaceRename>;

// The workspace title: an inline input while renaming, otherwise a link.
function WorkspaceTitleField({
	workspace,
	href,
	rename,
}: {
	workspace: Workspace;
	href: string | null;
	rename: WorkspaceRename;
}) {
	if (rename.editing) {
		return (
			<input
				// biome-ignore lint/a11y/noAutofocus: inline rename should focus immediately
				autoFocus
				aria-label="Workspace name"
				value={rename.value}
				disabled={rename.isPending}
				onChange={(event) => rename.setValue(event.target.value)}
				onBlur={rename.submit}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						rename.submit();
					} else if (event.key === "Escape") {
						event.preventDefault();
						rename.cancel();
					}
				}}
				className="min-w-0 flex-1 rounded-md border border-kumo-line bg-kumo-base px-2 py-1 text-sm font-semibold outline-none focus:border-kumo-focus"
			/>
		);
	}

	if (href) {
		return (
			<Link
				href={href}
				className="truncate text-sm font-semibold hover:underline"
			>
				{workspace.name}
			</Link>
		);
	}
	return (
		<span className="truncate text-sm font-semibold">{workspace.name}</span>
	);
}

function RenameButton({ rename }: { rename: WorkspaceRename }) {
	return (
		<button
			type="button"
			aria-label="Rename workspace"
			onClick={rename.start}
			className="flex size-6 shrink-0 items-center justify-center rounded-md text-kumo-subtle transition-colors hover:bg-kumo-fill hover:text-kumo-default"
		>
			<Pencil className="size-3.5" />
		</button>
	);
}

// Per-workspace accent color picker: a swatch trigger opening a preset palette.
function WorkspaceColorPicker({ workspace }: { workspace: Workspace }) {
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const current = workspace.color ?? null;

	const update = api.workspaces.update.useMutation(
		crudMutationOptions({
			successMessage: "Workspace color updated",
			errorMessage: "Failed to update workspace color",
			loggerScope: "workspace",
			invalidate: () => utils.workspaces.all.invalidate(),
		}),
	);

	const choose = (color: string | null) => {
		setOpen(false);
		if (color === current) return;
		update.mutate({ workspaceId: workspace.workspaceId, color });
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<button
						type="button"
						aria-label="Workspace color"
						className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-kumo-fill"
					>
						<span
							className={cn(
								"size-4 rounded-full border border-black/10",
								!current && "bg-kumo-fill",
							)}
							style={current ? { backgroundColor: current } : undefined}
						/>
					</button>
				}
			/>
			<PopoverContent className="w-auto p-2" align="end">
				<div className="grid grid-cols-5 gap-1.5">
					<button
						type="button"
						aria-label="Default color"
						title="Default"
						onClick={() => choose(null)}
						className={cn(
							"flex size-7 items-center justify-center rounded-full border border-kumo-line text-kumo-subtle hover:bg-kumo-fill",
							current === null && "ring-2 ring-kumo-focus ring-offset-1",
						)}
					>
						<Ban className="size-3.5" />
					</button>
					{WORKSPACE_COLORS.map((color) => (
						<button
							key={color.value}
							type="button"
							aria-label={color.name}
							title={color.name}
							onClick={() => choose(color.value)}
							className={cn(
								"size-7 rounded-full border border-black/10",
								current === color.value &&
									"ring-2 ring-kumo-focus ring-offset-1",
							)}
							style={{ backgroundColor: color.value }}
						/>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function ProjectFooter({
	environmentCount,
	online,
	total,
	hasError,
}: {
	environmentCount: number;
	online: number;
	total: number;
	hasError: boolean;
}) {
	return (
		<div className="flex items-center gap-1.5 text-xs text-kumo-subtle">
			<span className="whitespace-nowrap">
				{environmentCount}{" "}
				{environmentCount === 1 ? "environment" : "environments"}
			</span>
			<span aria-hidden>·</span>
			<span className={cn("whitespace-nowrap", hasError && "text-kumo-danger")}>
				{servicesLabel(online, total)}
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

type SortKey = "recent" | "name";
type ViewMode = "grid" | "list";

const sortOptions: { value: SortKey; label: string }[] = [
	{ value: "recent", label: "Recent Activity" },
	{ value: "name", label: "Name" },
];

type ProjectEntry = {
	workspace: Workspace;
	environment: WorkspaceEnvironment | undefined;
	environmentCount: number;
	services: CardService[];
	online: number;
	total: number;
	hasError: boolean;
};

function ProjectCard({
	entry,
	canManage,
}: {
	entry: ProjectEntry;
	canManage: boolean;
}) {
	const {
		workspace,
		environment,
		environmentCount,
		services,
		online,
		total,
		hasError,
	} = entry;
	const href = environment
		? workspaceEnvironmentPath({
				workspaceId: workspace.workspaceId,
				environmentId: environment.environmentId,
			})
		: null;

	const rename = useWorkspaceRename(workspace);

	const navBody = (
		<>
			<ServicePreview services={services} />
			<ProjectFooter
				environmentCount={environmentCount}
				online={online}
				total={total}
				hasError={hasError}
			/>
		</>
	);
	const navClassName = "flex flex-1 flex-col gap-4";

	return (
		<div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-kumo-canvas p-5 transition-colors hover:border-kumo-line">
			<AccentStripe color={workspace.color} />
			<div className="flex items-center gap-2">
				<div className="flex min-w-0 flex-1">
					<WorkspaceTitleField
						workspace={workspace}
						href={href}
						rename={rename}
					/>
				</div>
				{canManage && (
					<div className="flex shrink-0 items-center gap-0.5">
						<RenameButton rename={rename} />
						<WorkspaceColorPicker workspace={workspace} />
					</div>
				)}
			</div>
			{href ? (
				<Link href={href} className={navClassName}>
					{navBody}
				</Link>
			) : (
				<div className={navClassName}>{navBody}</div>
			)}
		</div>
	);
}

function ProjectRow({
	entry,
	canManage,
}: {
	entry: ProjectEntry;
	canManage: boolean;
}) {
	const { workspace, environment, environmentCount, online, total, hasError } =
		entry;
	const href = environment
		? workspaceEnvironmentPath({
				workspaceId: workspace.workspaceId,
				environmentId: environment.environmentId,
			})
		: null;
	const rename = useWorkspaceRename(workspace);

	const iconBox = (
		<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/30">
			<BookIcon className="size-4 text-kumo-subtle" />
		</span>
	);

	return (
		<li className="group relative flex items-center gap-4 overflow-hidden rounded-lg border bg-kumo-canvas px-4 py-3 transition-colors hover:border-kumo-line">
			<AccentStripe color={workspace.color} />
			{href ? (
				<Link href={href} className="shrink-0">
					{iconBox}
				</Link>
			) : (
				iconBox
			)}
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex min-w-0">
					<WorkspaceTitleField
						workspace={workspace}
						href={href}
						rename={rename}
					/>
				</div>
				<span className="truncate text-xs text-kumo-subtle">
					{environmentCount}{" "}
					{environmentCount === 1 ? "environment" : "environments"} ·{" "}
					<span className={cn(hasError && "text-kumo-danger")}>
						{servicesLabel(online, total)}
					</span>
				</span>
			</div>
			{canManage && (
				<div className="flex shrink-0 items-center gap-0.5">
					<RenameButton rename={rename} />
					<WorkspaceColorPicker workspace={workspace} />
				</div>
			)}
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
				environmentCount: workspace.environments.length,
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
			title="Workspaces"
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
								<ProjectCard
									key={entry.workspace.workspaceId}
									entry={entry}
									canManage={canCreateWorkspaces}
								/>
							))}
						</div>
					) : (
						<ul className="flex flex-col gap-2">
							{projects.map((entry) => (
								<ProjectRow
									key={entry.workspace.workspaceId}
									entry={entry}
									canManage={canCreateWorkspaces}
								/>
							))}
						</ul>
					)}
				</>
			)}
		</SectionCard>
	);
};
