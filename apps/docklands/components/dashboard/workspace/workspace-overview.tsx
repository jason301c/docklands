import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { formatDistanceToNow } from "date-fns";
import {
	AlertTriangle,
	ArrowRight,
	BookIcon,
	FolderInput,
	MoreHorizontalIcon,
	Rocket,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { HandleWorkspace } from "@/components/dashboard/workspace/manage/handle-workspace";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";
import {
	workspaceEnvironmentPath,
	workspaceServicePath,
} from "@/shared/routes";

const logger = createClientLogger("workspace");

type DeploymentStatus = "idle" | "running" | "done" | "error";

// The six managed-database engines now share one `database` collection.
const serviceCollections = ["applications", "compose", "database"] as const;

type EnvironmentWithServices = Record<
	(typeof serviceCollections)[number],
	unknown[]
>;

const countEnvironmentServices = (environment: EnvironmentWithServices) =>
	serviceCollections.reduce(
		(total, collection) => total + environment[collection].length,
		0,
	);

const countProjectServices = (workspace: {
	environments: EnvironmentWithServices[];
}) =>
	workspace.environments.reduce(
		(total, environment) => total + countEnvironmentServices(environment),
		0,
	);

const statusDotClass: Record<string, string> = {
	done: "bg-kumo-success",
	running: "bg-kumo-warning",
	error: "bg-kumo-danger",
	idle: "bg-kumo-subtle/40",
};

type CentralizedDeployment =
	RouterOutputs["deployment"]["allCentralized"][number];

function getServiceInfo(d: CentralizedDeployment) {
	const app = d.application;
	const comp = d.compose;
	if (app?.environment?.workspace && app.environment) {
		return {
			name: app.name as string,
			environment: app.environment.name as string,
			projectName: app.environment.workspace.name as string,
			href: workspaceServicePath({
				workspaceId: app.environment.workspace.workspaceId,
				environmentId: app.environment.environmentId,
				serviceType: "application",
				serviceId: app.applicationId,
			}),
		};
	}
	if (comp?.environment?.workspace && comp.environment) {
		return {
			name: comp.name as string,
			environment: comp.environment.name as string,
			projectName: comp.environment.workspace.name as string,
			href: workspaceServicePath({
				workspaceId: comp.environment.workspace.workspaceId,
				environmentId: comp.environment.environmentId,
				serviceType: "compose",
				serviceId: comp.composeId,
			}),
		};
	}
	return null;
}

function StatCard({
	label,
	value,
	delta,
}: {
	label: string;
	value: string;
	delta?: string;
}) {
	return (
		<div className="flex min-h-[140px] flex-col justify-between rounded-lg border bg-kumo-canvas p-5">
			<span className="text-xs uppercase tracking-wider text-kumo-subtle">
				{label}
			</span>
			<div className="flex flex-col gap-1">
				<span className="text-3xl font-semibold tracking-tight">{value}</span>
				{delta && <span className="text-xs text-kumo-subtle">{delta}</span>}
			</div>
		</div>
	);
}

function StatusListCard({
	label,
	items,
}: {
	label: string;
	items: { dotClass: string; label: string; count: number }[];
}) {
	return (
		<div className="flex min-h-[140px] flex-col gap-3 rounded-lg border bg-kumo-canvas p-5">
			<span className="text-xs uppercase tracking-wider text-kumo-subtle">
				{label}
			</span>
			<ul className="flex flex-col gap-1.5">
				{items.map((item) => (
					<li key={item.label} className="flex items-center gap-2.5 text-sm">
						<span
							className={`size-2 rounded-full shrink-0 ${item.dotClass}`}
							aria-hidden
						/>
						<span className="font-semibold tabular-nums w-8">{item.count}</span>
						<span className="text-kumo-subtle">{item.label}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function FirstRunWorkspacePanel({
	canCreateWorkspaces,
}: {
	canCreateWorkspaces: boolean;
}) {
	return (
		<div className="flex min-h-[560px] items-center justify-center rounded-lg border bg-kumo-canvas px-6 py-12">
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

// Per-workspace management (rename/tags/delete). This used to live on the
// separate `?view=workspaces` list; it now hangs off each row in the overview's
// Workspaces panel so the overview is the single workspace surface.
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

export const WorkspaceOverview = () => {
	const { data: auth } = api.user.get.useQuery();
	const { data: homeStats } = api.workspaces.homeStats.useQuery();
	const { data: workspaces } = api.workspaces.all.useQuery();
	const { permissions } = usePermissions();
	const canCreateWorkspaces = !!permissions?.workspace.create;
	const canReadDeployments = !!permissions?.deployment.read;
	const { data: deployments } = api.deployment.allCentralized.useQuery(
		undefined,
		{
			enabled: canReadDeployments,
			refetchInterval: 10000,
		},
	);

	const firstName = auth?.user?.firstName?.trim();

	const totals = homeStats ?? {
		workspaces: 0,
		environments: 0,
		applications: 0,
		compose: 0,
		databases: 0,
		services: 0,
	};
	const statusBreakdown = homeStats?.status ?? {
		running: 0,
		error: 0,
		idle: 0,
	};

	const recentDeployments = useMemo(() => {
		if (!deployments) return [];
		return [...deployments]
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			)
			.slice(0, 10);
	}, [deployments]);

	const deployStats = useMemo(() => {
		const now = Date.now();
		const weekMs = 7 * 24 * 60 * 60 * 1000;
		const lastStart = now - weekMs;
		const prevStart = now - 2 * weekMs;

		const last: NonNullable<typeof deployments> = [];
		const prev: NonNullable<typeof deployments> = [];
		for (const d of deployments ?? []) {
			const t = new Date(d.createdAt).getTime();
			if (t >= lastStart) last.push(d);
			else if (t >= prevStart) prev.push(d);
		}

		const lastCount = last.length;
		const prevCount = prev.length;
		let delta: string | undefined;
		if (prevCount > 0) {
			const pct = Math.round(((lastCount - prevCount) / prevCount) * 100);
			delta = `${pct >= 0 ? "+" : ""}${pct}% vs prev 7d`;
		} else if (lastCount > 0) {
			delta = "no prior data";
		} else {
			delta = "no activity yet";
		}

		return { value: String(lastCount), delta };
	}, [deployments]);

	const recentProjects = useMemo(() => {
		if (!workspaces) return [];

		return [...workspaces]
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			)
			.slice(0, 6)
			.map((workspace) => {
				const environment =
					workspace.environments.find((item) => item.isDefault) ||
					workspace.environments[0];

				return {
					workspace,
					environment,
					services: countProjectServices(workspace),
				};
			});
	}, [workspaces]);

	const hasWorkspaceData = workspaces !== undefined || homeStats !== undefined;
	const showFirstRun =
		hasWorkspaceData && totals.workspaces === 0 && recentProjects.length === 0;
	const isDeploymentsLoading = canReadDeployments && deployments === undefined;
	const isWorkspacesLoading = !hasWorkspaceData;

	return (
		<div className="w-full">
			<div className="flex min-h-[85vh] flex-col gap-6 rounded-lg border bg-kumo-canvas p-6">
				<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
						{firstName ? `Welcome back, ${firstName}` : "Welcome back"}
					</h1>
					{canCreateWorkspaces && (
						<div className="flex flex-wrap items-center gap-2">
							<HandleWorkspace />
						</div>
					)}
				</div>

				{showFirstRun ? (
					<FirstRunWorkspacePanel canCreateWorkspaces={canCreateWorkspaces} />
				) : (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<StatCard
								label="Workspaces"
								value={String(totals.workspaces)}
								delta={`${totals.environments} ${totals.environments === 1 ? "environment" : "environments"}`}
							/>
							<StatCard
								label="Services"
								value={String(totals.services)}
								delta={`${totals.applications} apps · ${totals.compose} compose · ${totals.databases} db`}
							/>
							<StatCard
								label="Deployments / 7d"
								value={deployStats.value}
								delta={deployStats.delta}
							/>
							<StatusListCard
								label="Status"
								items={[
									{
										dotClass: "bg-kumo-success",
										label: "running",
										count: statusBreakdown.running,
									},
									{
										dotClass: "bg-kumo-danger",
										label: "errored",
										count: statusBreakdown.error,
									},
									{
										dotClass: "bg-kumo-subtle/40",
										label: "idle",
										count: statusBreakdown.idle,
									},
								]}
							/>
						</div>

						<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
							<div className="rounded-lg border bg-kumo-canvas">
								<div className="flex items-center justify-between px-5 py-4 border-b">
									<div className="flex items-center gap-2">
										<Rocket className="size-4 text-kumo-subtle" />
										<h2 className="text-sm font-semibold">
											Recent deployments
										</h2>
									</div>
									{canReadDeployments && (
										<Link
											href="/dashboard/deployments"
											className="text-xs text-kumo-subtle hover:text-kumo-default transition-colors"
										>
											view all →
										</Link>
									)}
								</div>
								{!canReadDeployments ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-kumo-subtle p-10">
										<Rocket className="size-8 opacity-40" />
										<span>You do not have permission to view deployments.</span>
									</div>
								) : isDeploymentsLoading ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-kumo-subtle p-10">
										<Rocket className="size-8 opacity-40" />
										<span>Loading deployments...</span>
									</div>
								) : recentDeployments.length === 0 ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-kumo-subtle p-10">
										<Rocket className="size-8 opacity-40" />
										<span>No recent deployments.</span>
									</div>
								) : (
									<ul className="divide-y">
										{recentDeployments.map((d) => {
											const info = getServiceInfo(d);
											if (!info) return null;
											const status = (d.status ?? "idle") as DeploymentStatus;
											return (
												<li key={d.deploymentId}>
													<Link
														href={info.href}
														className="flex items-center gap-4 px-5 py-4 hover:bg-kumo-fill/40 transition-colors"
													>
														<span
															className={`size-2 rounded-full shrink-0 ${statusDotClass[status] ?? statusDotClass.idle}`}
															aria-hidden
														/>
														<div className="flex flex-col min-w-0 flex-1">
															<span className="text-sm truncate">
																{info.name}
															</span>
															<span className="text-xs text-kumo-subtle truncate">
																{info.projectName} · {info.environment}
															</span>
														</div>
														<span className="text-xs text-kumo-subtle w-36 hidden lg:flex items-center justify-end gap-1.5 truncate">
															<Rocket className="size-3 shrink-0" />
															<span className="truncate">Runtime</span>
														</span>
														<span className="text-xs text-kumo-subtle w-20 text-right hidden sm:inline">
															{status}
														</span>
														<span className="text-xs text-kumo-subtle w-24 text-right hidden md:inline">
															{formatDistanceToNow(new Date(d.createdAt), {
																addSuffix: true,
															})}
														</span>
														<span className="text-xs text-kumo-subtle hover:text-kumo-default transition-colors">
															logs →
														</span>
													</Link>
												</li>
											);
										})}
									</ul>
								)}
							</div>

							<div className="rounded-lg border bg-kumo-canvas">
								<div className="flex items-center gap-2 px-5 py-4 border-b">
									<FolderInput className="size-4 text-kumo-subtle" />
									<h2 className="text-sm font-semibold">Workspaces</h2>
								</div>

								{isWorkspacesLoading ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-kumo-subtle p-10">
										<FolderInput className="size-8 opacity-40" />
										<span>Loading workspaces...</span>
									</div>
								) : recentProjects.length === 0 ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-kumo-subtle p-10">
										<FolderInput className="size-8 opacity-40" />
										<span>No recent workspaces.</span>
									</div>
								) : (
									<ul className="divide-y">
										{recentProjects.map(
											({ workspace, environment, services }) => {
												const href = environment
													? workspaceEnvironmentPath({
															workspaceId: workspace.workspaceId,
															environmentId: environment.environmentId,
														})
													: null;
												const rowBody = (
													<>
														<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/30">
															<BookIcon className="size-4 text-kumo-subtle" />
														</span>
														<div className="flex flex-col min-w-0 flex-1">
															<span className="text-sm truncate">
																{workspace.name}
															</span>
															<span className="text-xs text-kumo-subtle truncate">
																{environment?.name ?? "No environment"} ·{" "}
																{services}{" "}
																{services === 1 ? "service" : "services"}
															</span>
														</div>
														{href && (
															<ArrowRight className="size-4 shrink-0 text-kumo-subtle" />
														)}
													</>
												);

												return (
													<li
														key={workspace.workspaceId}
														className="flex items-center pr-3 hover:bg-kumo-fill/40 transition-colors"
													>
														{href ? (
															<Link
																href={href}
																className="flex flex-1 items-center gap-4 px-5 py-4 min-w-0"
															>
																{rowBody}
															</Link>
														) : (
															<div className="flex flex-1 items-center gap-4 px-5 py-4 min-w-0">
																{rowBody}
															</div>
														)}
														<WorkspaceRowActions
															workspaceId={workspace.workspaceId}
															serviceCount={services}
														/>
													</li>
												);
											},
										)}
									</ul>
								)}
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
};
