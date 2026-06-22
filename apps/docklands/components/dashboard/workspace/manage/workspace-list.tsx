import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import {
	AlertTriangle,
	ArrowUpDown,
	BookIcon,
	Boxes,
	Database,
	FolderInput,
	Loader2,
	MoreHorizontalIcon,
	Rocket,
	Search,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/client/api/trpc";
import { useDebounce } from "@/client/hooks/use-debounce";
import { BreadcrumbSidebar } from "@/components/shared/breadcrumb-sidebar";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";
import { TagBadge } from "@/components/shared/tag-badge";
import { TagFilter } from "@/components/shared/tag-filter";
import { toast } from "@/components/shared/toast";
import {
	workspaceEnvironmentPath,
	workspaceListPath,
	workspaceOverviewPath,
} from "@/shared/routes";
import { HandleWorkspace } from "./handle-workspace";
import { WorkspaceVariables } from "./workspace-variables";

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

const countProjectServiceTypes = (project: {
	environments: EnvironmentWithServices[];
}) =>
	project.environments.reduce(
		(total, environment) => ({
			applications: total.applications + environment.applications.length,
			compose: total.compose + environment.compose.length,
			databases:
				total.databases +
				environment.libsql.length +
				environment.mariadb.length +
				environment.mongo.length +
				environment.mysql.length +
				environment.postgres.length +
				environment.redis.length,
		}),
		{ applications: 0, compose: 0, databases: 0 },
	);

export const WorkspaceList = () => {
	const utils = api.useUtils();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentPathname = pathname ?? workspaceOverviewPath;
	const { data, isPending } = api.workspaces.all.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { mutateAsync } = api.workspaces.remove.useMutation();
	const { data: availableTags } = api.tag.all.useQuery();

	const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") ?? "");
	const debouncedSearchQuery = useDebounce(searchQuery, 500);

	const [sortBy, setSortBy] = useState<string>(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("workspaceListSort") || "createdAt-desc";
		}
		return "createdAt-desc";
	});

	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("workspaceListTagFilter");
			return saved ? JSON.parse(saved) : [];
		}
		return [];
	});

	useEffect(() => {
		localStorage.setItem("workspaceListSort", sortBy);
	}, [sortBy]);

	useEffect(() => {
		localStorage.setItem(
			"workspaceListTagFilter",
			JSON.stringify(selectedTagIds),
		);
	}, [selectedTagIds]);

	useEffect(() => {
		if (!availableTags) return;
		const validIds = new Set(availableTags.map((t) => t.tagId));
		setSelectedTagIds((prev) => {
			const filtered = prev.filter((id) => validIds.has(id));
			return filtered.length === prev.length ? prev : filtered;
		});
	}, [availableTags]);

	useEffect(() => {
		const urlQuery = searchParams?.get("q") ?? "";
		if (urlQuery !== searchQuery) {
			setSearchQuery(urlQuery);
		}
	}, [searchParams, searchQuery]);

	useEffect(() => {
		const urlQuery = searchParams?.get("q") ?? "";
		if (debouncedSearchQuery === urlQuery) return;

		const newQuery = new URLSearchParams(searchParams?.toString() ?? "");
		if (debouncedSearchQuery) {
			newQuery.set("q", debouncedSearchQuery);
		} else {
			newQuery.delete("q");
		}
		const suffix = newQuery.toString();
		router.replace(suffix ? `${currentPathname}?${suffix}` : currentPathname, {
			scroll: false,
		});
	}, [currentPathname, debouncedSearchQuery, router, searchParams]);

	const filteredProjects = useMemo(() => {
		if (!data) return [];

		let filtered = data.filter(
			(project) =>
				project.name
					.toLowerCase()
					.includes(debouncedSearchQuery.toLowerCase()) ||
				project.description
					?.toLowerCase()
					.includes(debouncedSearchQuery.toLowerCase()),
		);

		// Filter by selected tags (OR logic: show workspaces with ANY selected tag).
		if (selectedTagIds.length > 0) {
			filtered = filtered.filter((project) =>
				project.projectTags?.some((pt) =>
					selectedTagIds.includes(pt.tag.tagId),
				),
			);
		}

		// Then sort the filtered results
		const [field, direction] = sortBy.split("-");
		return [...filtered].sort((a, b) => {
			let comparison = 0;
			switch (field) {
				case "name":
					comparison = a.name.localeCompare(b.name);
					break;
				case "createdAt":
					comparison =
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
				case "services": {
					comparison = countProjectServices(a) - countProjectServices(b);
					break;
				}
				default:
					comparison = 0;
			}
			return direction === "asc" ? comparison : -comparison;
		});
	}, [data, debouncedSearchQuery, sortBy, selectedTagIds]);

	const visibleServicesCount = filteredProjects.reduce(
		(total, project) => total + countProjectServices(project),
		0,
	);
	const visibleEnvironmentCount = filteredProjects.reduce(
		(total, project) => total + project.environments.length,
		0,
	);
	const visibleServiceCounts = filteredProjects.reduce(
		(total, project) => {
			const counts = countProjectServiceTypes(project);
			return {
				applications: total.applications + counts.applications,
				compose: total.compose + counts.compose,
				databases: total.databases + counts.databases,
			};
		},
		{ applications: 0, compose: 0, databases: 0 },
	);

	return (
		<>
			<BreadcrumbSidebar
				list={[
					{ name: "Canvas", href: workspaceOverviewPath },
					{ name: "Workspaces", href: workspaceListPath },
				]}
			/>
			<div className="w-full">
				<div className="rounded-lg border bg-background">
					<div className="flex w-full flex-wrap items-center justify-between gap-4 p-6">
						<div className="p-0">
							<h3 className="text-xl flex flex-row gap-2">
								<FolderInput className="size-6 text-muted-foreground self-center" />
								Workspaces
							</h3>
							<p className="text-sm text-muted-foreground">
								{filteredProjects.length} visible · {visibleServicesCount}{" "}
								services
							</p>
						</div>
						{permissions?.project.create && (
							<div className="">
								<HandleWorkspace />
							</div>
						)}
					</div>

					<div className="flex min-h-[60vh] flex-col gap-4 border-t p-6">
						{isPending ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[60vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<>
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									<div className="rounded-md border bg-background p-4">
										<p className="text-xs uppercase text-muted-foreground">
											Visible workspaces
										</p>
										<p className="mt-2 text-2xl font-semibold tabular-nums">
											{filteredProjects.length}
										</p>
										<p className="mt-2 text-xs text-muted-foreground">
											{visibleEnvironmentCount} environments
										</p>
									</div>
									<div className="rounded-md border bg-background p-4">
										<p className="text-xs uppercase text-muted-foreground">
											Applications
										</p>
										<p className="mt-2 text-2xl font-semibold tabular-nums">
											{visibleServiceCounts.applications}
										</p>
										<p className="mt-2 text-xs text-muted-foreground">
											Runtime services across visible workspaces
										</p>
									</div>
									<div className="rounded-md border bg-background p-4">
										<p className="text-xs uppercase text-muted-foreground">
											Compose stacks
										</p>
										<p className="mt-2 text-2xl font-semibold tabular-nums">
											{visibleServiceCounts.compose}
										</p>
										<p className="mt-2 text-xs text-muted-foreground">
											Stack services ready for the canvas
										</p>
									</div>
									<div className="rounded-md border bg-background p-4">
										<p className="text-xs uppercase text-muted-foreground">
											Data services
										</p>
										<p className="mt-2 text-2xl font-semibold tabular-nums">
											{visibleServiceCounts.databases}
										</p>
										<p className="mt-2 text-xs text-muted-foreground">
											Databases and caches available to link
										</p>
									</div>
								</div>

								<div className="flex max-sm:flex-col gap-4 items-center w-full">
									<div className="flex-1 relative max-sm:w-full">
										<FocusShortcutInput
											placeholder="Filter workspaces..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="pr-10"
										/>

										<Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
									</div>
									<div className="flex items-center gap-2">
										<TagFilter
											tags={
												availableTags?.map((tag) => ({
													id: tag.tagId,
													name: tag.name,
													color: tag.color || undefined,
												})) || []
											}
											selectedTags={selectedTagIds}
											onTagsChange={setSelectedTagIds}
										/>
										<div className="flex items-center gap-2 min-w-48 max-sm:w-full">
											<ArrowUpDown className="size-4 text-muted-foreground" />
											<Select
												aria-label="Workspace sort order"
												value={sortBy}
												onValueChange={(value) =>
													value !== null && setSortBy(value as never)
												}
											>
												<Select.Option value="name-asc">
													Name (A-Z)
												</Select.Option>
												<Select.Option value="name-desc">
													Name (Z-A)
												</Select.Option>
												<Select.Option value="createdAt-desc">
													Newest first
												</Select.Option>
												<Select.Option value="createdAt-asc">
													Oldest first
												</Select.Option>
												<Select.Option value="services-desc">
													Most services
												</Select.Option>
												<Select.Option value="services-asc">
													Least services
												</Select.Option>
											</Select>
										</div>
									</div>
								</div>
								{filteredProjects?.length === 0 && (
									<div className="mt-6 flex h-[50vh] w-full flex-col items-center justify-center space-y-4">
										<FolderInput className="size-8 self-center text-muted-foreground" />
										<span className="text-center font-medium text-muted-foreground">
											No workspaces found
										</span>
									</div>
								)}
								<div className="w-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 flex-wrap gap-5">
									{filteredProjects?.map((project) => {
										const totalServices = countProjectServices(project);
										const serviceCounts = countProjectServiceTypes(project);
										const emptyServices = totalServices === 0;
										const accessibleEnvironment =
											project?.environments.find((env) => env.isDefault) ||
											project?.environments?.[0];
										const visibleEnvironments = project.environments.slice(
											0,
											3,
										);
										const hiddenEnvironmentCount = Math.max(
											0,
											project.environments.length - visibleEnvironments.length,
										);
										const hasNoEnvironments = !accessibleEnvironment;
										const workspaceHref = hasNoEnvironments
											? null
											: workspaceEnvironmentPath({
													workspaceId: project.projectId,
													environmentId: accessibleEnvironment.environmentId,
												});

										return (
											<LayerCard
												key={project.projectId}
												className="group flex h-full min-h-[230px] flex-col bg-background transition-colors hover:bg-muted/30"
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0 space-y-1.5">
														<div className="flex min-w-0 items-center gap-2">
															<BookIcon className="size-4 shrink-0 text-muted-foreground" />
															{workspaceHref ? (
																<Link
																	href={workspaceHref}
																	className="truncate text-base font-medium leading-none hover:underline"
																>
																	{project.name}
																</Link>
															) : (
																<span className="truncate text-base font-medium leading-none">
																	{project.name}
																</span>
															)}
														</div>
														{project.description && (
															<p className="line-clamp-2 text-sm text-muted-foreground">
																{project.description}
															</p>
														)}
													</div>

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
															<DropdownMenu.Label className="font-normal">
																Actions
															</DropdownMenu.Label>
															<div onClick={(e) => e.stopPropagation()}>
																<WorkspaceVariables
																	projectId={project.projectId}
																/>
															</div>
															<div onClick={(e) => e.stopPropagation()}>
																<HandleWorkspace
																	projectId={project.projectId}
																/>
															</div>

															<div onClick={(e) => e.stopPropagation()}>
																{permissions?.project.delete && (
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
																			<div>
																				<Dialog.Title>
																					Delete workspace?
																				</Dialog.Title>
																				{!emptyServices ? (
																					<div className="flex flex-row gap-4 rounded-lg bg-yellow-50 p-2 dark:bg-yellow-950">
																						<AlertTriangle className="text-yellow-600 dark:text-yellow-400" />
																						<span className="text-sm text-yellow-600 dark:text-yellow-400">
																							Delete services first.
																						</span>
																					</div>
																				) : (
																					<Dialog.Description>
																						This action cannot be undone
																					</Dialog.Description>
																				)}
																			</div>
																			<div>
																				<Dialog.Close>Cancel</Dialog.Close>
																				<Dialog.Close
																					disabled={!emptyServices}
																					onClick={async () => {
																						try {
																							await mutateAsync({
																								projectId: project.projectId,
																							});
																							toast.success(
																								"Workspace deleted",
																							);
																						} catch {
																							toast.error(
																								"Error deleting this workspace",
																							);
																						} finally {
																							await utils.project.all.invalidate();
																						}
																					}}
																				>
																					Delete
																				</Dialog.Close>
																			</div>
																		</Dialog>
																	</Dialog.Root>
																)}
															</div>
														</DropdownMenu.Content>
													</DropdownMenu>
												</div>

												{project.projectTags &&
													project.projectTags.length > 0 && (
														<div className="mt-4 flex flex-wrap gap-1.5">
															{project.projectTags.map((pt) => (
																<TagBadge
																	key={pt.tag.tagId}
																	name={pt.tag.name}
																	color={pt.tag.color}
																/>
															))}
														</div>
													)}

												{visibleEnvironments.length > 0 && (
													<div className="mt-4 flex flex-wrap gap-1.5">
														{visibleEnvironments.map((environment) => (
															<span
																key={environment.environmentId}
																className="rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground"
															>
																{environment.name}
															</span>
														))}
														{hiddenEnvironmentCount > 0 && (
															<span className="rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
																+{hiddenEnvironmentCount} more
															</span>
														)}
													</div>
												)}

												{hasNoEnvironments && (
													<div className="mt-4 flex flex-row gap-2 rounded-lg bg-yellow-50 p-2 dark:bg-yellow-950">
														<AlertTriangle className="size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
														<span className="text-xs text-yellow-600 dark:text-yellow-400">
															No environments are available.
														</span>
													</div>
												)}

												<div className="mt-auto pt-5">
													<div className="grid grid-cols-4 gap-2 rounded-md border bg-muted/20 p-3 text-xs">
														<div className="space-y-1">
															<Rocket className="size-4 text-muted-foreground" />
															<div className="text-muted-foreground">Apps</div>
															<div className="text-lg font-semibold tabular-nums">
																{serviceCounts.applications}
															</div>
														</div>
														<div className="space-y-1">
															<Boxes className="size-4 text-muted-foreground" />
															<div className="text-muted-foreground">
																Stacks
															</div>
															<div className="text-lg font-semibold tabular-nums">
																{serviceCounts.compose}
															</div>
														</div>
														<div className="space-y-1">
															<Database className="size-4 text-muted-foreground" />
															<div className="text-muted-foreground">Data</div>
															<div className="text-lg font-semibold tabular-nums">
																{serviceCounts.databases}
															</div>
														</div>
														<div className="space-y-1">
															<FolderInput className="size-4 text-muted-foreground" />
															<div className="text-muted-foreground">Envs</div>
															<div className="text-lg font-semibold tabular-nums">
																{project.environments.length}
															</div>
														</div>
													</div>
													<div className="mt-4 flex items-center justify-between gap-3">
														<DateTooltip date={project.createdAt}>
															Created
														</DateTooltip>
														{workspaceHref ? (
															<Link href={workspaceHref}>
																<Button variant="outline">
																	Open workspace
																</Button>
															</Link>
														) : (
															<Button variant="outline" disabled>
																Open workspace
															</Button>
														)}
													</div>
												</div>
											</LayerCard>
										);
									})}
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</>
	);
};
