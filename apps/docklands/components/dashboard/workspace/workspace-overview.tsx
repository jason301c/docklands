import { LinkButton } from "@cloudflare/kumo/components/button";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, BookIcon, FolderInput, Rocket } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/client/api/trpc";
import { HandleWorkspace } from "@/components/dashboard/workspace/manage/handle-workspace";
import {
	workspaceEnvironmentPath,
	workspaceListPath,
	workspaceServicePath,
} from "@/shared/routes";

type DeploymentStatus = "idle" | "running" | "done" | "error";

const serviceCollections = [
	"applications",
	"compose",
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
	"redis",
] as const;

type EnvironmentWithServices = Record<
	(typeof serviceCollections)[number],
	unknown[]
>;

const countEnvironmentServices = (environment: EnvironmentWithServices) =>
	serviceCollections.reduce(
		(total, collection) => total + environment[collection].length,
		0,
	);

const countProjectServices = (project: {
	environments: EnvironmentWithServices[];
}) =>
	project.environments.reduce(
		(total, environment) => total + countEnvironmentServices(environment),
		0,
	);

const statusDotClass: Record<string, string> = {
	done: "bg-emerald-500",
	running: "bg-amber-500",
	error: "bg-red-500",
	idle: "bg-muted-foreground/40",
};

function getServiceInfo(d: any) {
	const app = d.application;
	const comp = d.compose;
	if (app?.environment?.project && app.environment) {
		return {
			name: app.name as string,
			environment: app.environment.name as string,
			projectName: app.environment.project.name as string,
			href: workspaceServicePath({
				projectId: app.environment.project.projectId,
				environmentId: app.environment.environmentId,
				serviceType: "application",
				serviceId: app.applicationId,
			}),
		};
	}
	if (comp?.environment?.project && comp.environment) {
		return {
			name: comp.name as string,
			environment: comp.environment.name as string,
			projectName: comp.environment.project.name as string,
			href: workspaceServicePath({
				projectId: comp.environment.project.projectId,
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
		<div className="flex min-h-[140px] flex-col justify-between rounded-lg border bg-background p-5">
			<span className="text-xs uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<div className="flex flex-col gap-1">
				<span className="text-3xl font-semibold tracking-tight">{value}</span>
				{delta && (
					<span className="text-xs text-muted-foreground">{delta}</span>
				)}
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
		<div className="flex min-h-[140px] flex-col gap-3 rounded-lg border bg-background p-5">
			<span className="text-xs uppercase tracking-wider text-muted-foreground">
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
						<span className="text-muted-foreground">{item.label}</span>
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
		<div className="flex min-h-[560px] items-center justify-center rounded-lg border bg-background px-6 py-12">
			<div className="flex w-full max-w-3xl flex-col items-center text-center">
				<span className="flex size-12 items-center justify-center rounded-lg border bg-muted/30">
					<FolderInput className="size-5 text-muted-foreground" />
				</span>
				<h2 className="mt-5 text-2xl font-semibold tracking-tight">
					Start from a workspace canvas
				</h2>
				<p className="mt-2 max-w-xl text-sm text-muted-foreground">
					Create the first workspace, then drop services onto one environment
					canvas.
				</p>
				<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
					{canCreateWorkspaces ? (
						<HandleWorkspace />
					) : (
						<LinkButton
							href={workspaceListPath}
							variant="secondary"
							className="w-fit"
						>
							Open workspaces
							<ArrowRight className="size-4" />
						</LinkButton>
					)}
				</div>

				<div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
					<div className="flex min-h-[112px] flex-col gap-3 rounded-lg border bg-muted/20 p-4 text-left">
						<FolderInput className="size-4 text-muted-foreground" />
						<div className="flex flex-col gap-1">
							<span className="text-sm font-medium">Workspace</span>
							<span className="text-xs text-muted-foreground">
								Name the system boundary.
							</span>
						</div>
					</div>
					<div className="flex min-h-[112px] flex-col gap-3 rounded-lg border bg-muted/20 p-4 text-left">
						<BookIcon className="size-4 text-muted-foreground" />
						<div className="flex flex-col gap-1">
							<span className="text-sm font-medium">Service</span>
							<span className="text-xs text-muted-foreground">
								Add Git, image, compose, or data.
							</span>
						</div>
					</div>
					<div className="flex min-h-[112px] flex-col gap-3 rounded-lg border bg-muted/20 p-4 text-left">
						<Rocket className="size-4 text-muted-foreground" />
						<div className="flex flex-col gap-1">
							<span className="text-sm font-medium">Runtime</span>
							<span className="text-xs text-muted-foreground">
								Deploy on this VM.
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export const WorkspaceOverview = () => {
	const { data: auth } = api.user.get.useQuery();
	const { data: homeStats } = api.project.homeStats.useQuery();
	const { data: projects } = api.project.all.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canCreateWorkspaces = !!permissions?.project.create;
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
		projects: 0,
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
		if (!projects) return [];

		return [...projects]
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			)
			.slice(0, 6)
			.map((project) => {
				const environment =
					project.environments.find((item) => item.isDefault) ||
					project.environments[0];

				return {
					project,
					environment,
					services: countProjectServices(project),
				};
			});
	}, [projects]);

	const hasWorkspaceData = projects !== undefined || homeStats !== undefined;
	const showFirstRun =
		hasWorkspaceData && totals.projects === 0 && recentProjects.length === 0;
	const isDeploymentsLoading = canReadDeployments && deployments === undefined;
	const isWorkspacesLoading = !hasWorkspaceData;

	return (
		<div className="w-full">
			<div className="flex min-h-[85vh] flex-col gap-6 rounded-lg border bg-background p-6">
				<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
					<h1 className="text-3xl font-semibold tracking-tight">
						{firstName ? `Welcome back, ${firstName}` : "Welcome back"}
					</h1>
					<div className="flex flex-wrap items-center gap-2">
						<LinkButton
							href={workspaceListPath}
							variant="secondary"
							className="w-fit"
						>
							Manage workspaces
							<ArrowRight className="size-4" />
						</LinkButton>
						{canCreateWorkspaces && <HandleWorkspace />}
					</div>
				</div>

				{showFirstRun ? (
					<FirstRunWorkspacePanel canCreateWorkspaces={canCreateWorkspaces} />
				) : (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<StatCard
								label="Workspaces"
								value={String(totals.projects)}
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
										dotClass: "bg-emerald-500",
										label: "running",
										count: statusBreakdown.running,
									},
									{
										dotClass: "bg-red-500",
										label: "errored",
										count: statusBreakdown.error,
									},
									{
										dotClass: "bg-muted-foreground/40",
										label: "idle",
										count: statusBreakdown.idle,
									},
								]}
							/>
						</div>

						<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
							<div className="rounded-lg border bg-background">
								<div className="flex items-center justify-between px-5 py-4 border-b">
									<div className="flex items-center gap-2">
										<Rocket className="size-4 text-muted-foreground" />
										<h2 className="text-sm font-semibold">
											Recent deployments
										</h2>
									</div>
									{canReadDeployments && (
										<Link
											href="/dashboard/deployments"
											className="text-xs text-muted-foreground hover:text-foreground transition-colors"
										>
											view all →
										</Link>
									)}
								</div>
								{!canReadDeployments ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground p-10">
										<Rocket className="size-8 opacity-40" />
										<span>You do not have permission to view deployments.</span>
									</div>
								) : isDeploymentsLoading ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground p-10">
										<Rocket className="size-8 opacity-40" />
										<span>Loading deployments...</span>
									</div>
								) : recentDeployments.length === 0 ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground p-10">
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
														className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
													>
														<span
															className={`size-2 rounded-full shrink-0 ${statusDotClass[status] ?? statusDotClass.idle}`}
															aria-hidden
														/>
														<div className="flex flex-col min-w-0 flex-1">
															<span className="text-sm truncate">
																{info.name}
															</span>
															<span className="text-xs text-muted-foreground truncate">
																{info.projectName} · {info.environment}
															</span>
														</div>
														<span className="text-xs text-muted-foreground w-36 hidden lg:flex items-center justify-end gap-1.5 truncate">
															<Rocket className="size-3 shrink-0" />
															<span className="truncate">Runtime</span>
														</span>
														<span className="text-xs text-muted-foreground w-20 text-right hidden sm:inline">
															{status}
														</span>
														<span className="text-xs text-muted-foreground w-24 text-right hidden md:inline">
															{formatDistanceToNow(new Date(d.createdAt), {
																addSuffix: true,
															})}
														</span>
														<span className="text-xs text-muted-foreground hover:text-foreground transition-colors">
															logs →
														</span>
													</Link>
												</li>
											);
										})}
									</ul>
								)}
							</div>

							<div className="rounded-lg border bg-background">
								<div className="flex items-center justify-between px-5 py-4 border-b">
									<div className="flex items-center gap-2">
										<FolderInput className="size-4 text-muted-foreground" />
										<h2 className="text-sm font-semibold">Workspaces</h2>
									</div>
									<Link
										href={workspaceListPath}
										className="text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										view all →
									</Link>
								</div>

								{isWorkspacesLoading ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground p-10">
										<FolderInput className="size-8 opacity-40" />
										<span>Loading workspaces...</span>
									</div>
								) : recentProjects.length === 0 ? (
									<div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground p-10">
										<FolderInput className="size-8 opacity-40" />
										<span>No recent workspaces.</span>
									</div>
								) : (
									<ul className="divide-y">
										{recentProjects.map(
											({ project, environment, services }) => (
												<li key={project.projectId}>
													<Link
														href={
															environment
																? workspaceEnvironmentPath({
																		projectId: project.projectId,
																		environmentId: environment.environmentId,
																	})
																: workspaceListPath
														}
														className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
													>
														<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/30">
															<BookIcon className="size-4 text-muted-foreground" />
														</span>
														<div className="flex flex-col min-w-0 flex-1">
															<span className="text-sm truncate">
																{project.name}
															</span>
															<span className="text-xs text-muted-foreground truncate">
																{environment?.name ?? "No environment"} ·{" "}
																{services}{" "}
																{services === 1 ? "service" : "services"}
															</span>
														</div>
														<ArrowRight className="size-4 shrink-0 text-muted-foreground" />
													</Link>
												</li>
											),
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
