import {
	AlertTriangle,
	ArrowUpDown,
	BookIcon,
	FolderInput,
	Loader2,
	MoreHorizontalIcon,
	Search,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { useDebounce } from "@/client/hooks/use-debounce";
import { BreadcrumbSidebar } from "@/components/shared/breadcrumb-sidebar";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";
import { TagBadge } from "@/components/shared/tag-badge";
import { TagFilter } from "@/components/shared/tag-filter";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Select } from "@cloudflare/kumo/components/select";
import { HandleProject } from "./handle-project";
import { ProjectEnvironment } from "./project-environment";

export const ShowProjects = () => {
	const utils = api.useUtils();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentPathname = pathname ?? "/dashboard/projects";
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data, isPending } = api.project.all.useQuery();
	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { mutateAsync } = api.project.remove.useMutation();
	const { data: availableTags } = api.tag.all.useQuery();

	const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") ?? "");
	const debouncedSearchQuery = useDebounce(searchQuery, 500);

	const [sortBy, setSortBy] = useState<string>(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("projectsSort") || "createdAt-desc";
		}
		return "createdAt-desc";
	});

	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("projectsTagFilter");
			return saved ? JSON.parse(saved) : [];
		}
		return [];
	});

	useEffect(() => {
		localStorage.setItem("projectsSort", sortBy);
	}, [sortBy]);

	useEffect(() => {
		localStorage.setItem("projectsTagFilter", JSON.stringify(selectedTagIds));
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

		// Filter by selected tags (OR logic: show projects with ANY selected tag)
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
					const aTotalServices = a.environments.reduce((total, env) => {
						return (
							total +
							(env.applications?.length || 0) +
							(env.libsql?.length || 0) +
							(env.mariadb?.length || 0) +
							(env.mongo?.length || 0) +
							(env.mysql?.length || 0) +
							(env.postgres?.length || 0) +
							(env.redis?.length || 0) +
							(env.compose?.length || 0)
						);
					}, 0);
					const bTotalServices = b.environments.reduce((total, env) => {
						return (
							total +
							(env.applications?.length || 0) +
							(env.libsql?.length || 0) +
							(env.mariadb?.length || 0) +
							(env.mongo?.length || 0) +
							(env.mysql?.length || 0) +
							(env.postgres?.length || 0) +
							(env.redis?.length || 0) +
							(env.compose?.length || 0)
						);
					}, 0);
					comparison = aTotalServices - bTotalServices;
					break;
				}
				default:
					comparison = 0;
			}
			return direction === "asc" ? comparison : -comparison;
		});
	}, [data, debouncedSearchQuery, sortBy, selectedTagIds]);

	return (
		<>
			<BreadcrumbSidebar
				list={[{ name: "Projects", href: "/dashboard/projects" }]}
			/>
			<div className="w-full">
				<LayerCard className="h-full bg-sidebar p-2.5 rounded-xl  ">
					<div className="rounded-xl bg-background shadow-md ">
						<div className="flex justify-between gap-4 w-full items-center flex-wrap p-6">
							<div className="p-0">
								<h3 className="text-xl flex flex-row gap-2">
									<FolderInput className="size-6 text-muted-foreground self-center" />
									Projects
								</h3>
								<p>
									Create and manage your projects
								</p>
							</div>
							{permissions?.project.create && (
								<div className="">
									<HandleProject />
								</div>
							)}
						</div>

						<div className="space-y-2 py-8 border-t gap-4 flex flex-col min-h-[60vh]">
							{isPending ? (
								<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[60vh]">
									<span>Loading...</span>
									<Loader2 className="animate-spin size-4" />
								</div>
							) : (
								<>
									<div className="flex max-sm:flex-col gap-4 items-center w-full">
										<div className="flex-1 relative max-sm:w-full">
											<FocusShortcutInput
												placeholder="Filter projects..."
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
												<Select aria-label="Select option" value={sortBy} onValueChange={(value) => value !== null && setSortBy(value as never)}>
													<>
														
													</>
													<>
														<Select.Option value="name-asc">Name (A-Z)</Select.Option>
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
													</>
												</Select>
											</div>
										</div>
									</div>
									{filteredProjects?.length === 0 && (
										<div className="mt-6 flex h-[50vh] w-full flex-col items-center justify-center space-y-4">
											<FolderInput className="size-8 self-center text-muted-foreground" />
											<span className="text-center font-medium text-muted-foreground">
												No projects found
											</span>
										</div>
									)}
									<div className="w-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 flex-wrap gap-5">
										{filteredProjects?.map((project) => {
											const emptyServices = project?.environments
												.map(
													(env) =>
														env.applications.length === 0 &&
														env.compose.length === 0 &&
														env.libsql.length === 0 &&
														env.mariadb.length === 0 &&
														env.mongo.length === 0 &&
														env.mysql.length === 0 &&
														env.postgres.length === 0 &&
														env.redis.length === 0,
												)
												.every(Boolean);

											const totalServices = project?.environments
												.map(
													(env) =>
														env.applications.length +
														env.compose.length +
														env.libsql.length +
														env.mariadb.length +
														env.mongo.length +
														env.mysql.length +
														env.postgres.length +
														env.redis.length,
												)
												.reduce((acc, curr) => acc + curr, 0);

											// Find default environment from accessible environments, or fall back to first accessible environment
											const accessibleEnvironment =
												project?.environments.find((env) => env.isDefault) ||
												project?.environments?.[0];

											const hasNoEnvironments = !accessibleEnvironment;

											return (
												<div
													key={project.projectId}
													className="w-full lg:max-w-md"
												>
													<Link
														href={
															hasNoEnvironments
																? "#"
																: `/dashboard/project/${project.projectId}/environment/${accessibleEnvironment?.environmentId}`
														}
														onClick={(
															e: React.MouseEvent<HTMLAnchorElement>,
														) => {
															if (hasNoEnvironments) {
																e.preventDefault();
															}
														}}
													>
														<LayerCard className="group relative w-full h-full bg-transparent transition-colors hover:bg-border flex flex-col">
															<div>
																<h3 className="flex items-center justify-between gap-2 overflow-clip">
																	<span className="flex flex-col gap-1.5 ">
																		<div className="flex items-center gap-2">
																			<BookIcon className="size-4 text-muted-foreground" />
																			<span className="text-base font-medium leading-none">
																				{project.name}
																			</span>
																		</div>

																		<span className="text-sm font-medium text-muted-foreground break-normal">
																			{project.description}
																		</span>

																		{project.projectTags &&
																			project.projectTags.length > 0 && (
																				<div className="flex flex-wrap gap-1.5 mt-2">
																					{project.projectTags.map((pt) => (
																						<TagBadge
																							key={pt.tag.tagId}
																							name={pt.tag.name}
																							color={pt.tag.color}
																						/>
																					))}
																				</div>
																			)}

																		{hasNoEnvironments && (
																			<div className="flex flex-row gap-2 items-center rounded-lg bg-yellow-50 p-2 mt-2 dark:bg-yellow-950">
																				<AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
																				<span className="text-xs text-yellow-600 dark:text-yellow-400">
																					You have access to this project but no
																					environments are available
																				</span>
																			</div>
																		)}
																	</span>
																	<div className="flex self-start space-x-1">
																		<DropdownMenu>
																			<DropdownMenu.Trigger render={(

																				<Button aria-label="Action"
																					variant="ghost"
																					shape="square"
																					className="px-2"
																				>
																					<MoreHorizontalIcon className="size-5" />
																				</Button>
																			
)} />
																			<DropdownMenu.Content
																				className="w-[200px] space-y-2 overflow-y-auto max-h-[280px]"
																				onClick={(e) => e.stopPropagation()}
																			>
																				<DropdownMenu.Label className="font-normal">
																					Actions
																				</DropdownMenu.Label>
																				<div
																					onClick={(e) => e.stopPropagation()}
																				>
																					<ProjectEnvironment
																						projectId={project.projectId}
																					/>
																				</div>
																				<div
																					onClick={(e) => e.stopPropagation()}
																				>
																					<HandleProject
																						projectId={project.projectId}
																					/>
																				</div>

																				<div
																					onClick={(e) => e.stopPropagation()}
																				>
																					{permissions?.project.delete && (
																						<Dialog.Root role="alertdialog">
																							<Dialog.Trigger className="w-full">
																								<DropdownMenu.Item
																									className="w-full cursor-pointer  space-x-3"
																									onSelect={(e) =>
																										e.preventDefault()
																									}
																								>
																									<TrashIcon className="size-4" />
																									<span>Delete</span>
																								</DropdownMenu.Item>
																							</Dialog.Trigger>
																							<Dialog>
																								<div>
																									<Dialog.Title>
																										Are you sure to delete this
																										project?
																									</Dialog.Title>
																									{!emptyServices ? (
																										<div className="flex flex-row gap-4 rounded-lg bg-yellow-50 p-2 dark:bg-yellow-950">
																											<AlertTriangle className="text-yellow-600 dark:text-yellow-400" />
																											<span className="text-sm text-yellow-600 dark:text-yellow-400">
																												You have active
																												services, please delete
																												them first
																											</span>
																										</div>
																									) : (
																										<Dialog.Description>
																											This action cannot be
																											undone
																										</Dialog.Description>
																									)}
																								</div>
																								<div>
																									<Dialog.Close>
																										Cancel
																									</Dialog.Close>
																									<Dialog.Close
																										disabled={!emptyServices}
																										onClick={async () => {
																											await mutateAsync({
																												projectId:
																													project.projectId,
																											})
																												.then(() => {
																													toast.success(
																														"Project deleted successfully",
																													);
																												})
																												.catch(() => {
																													toast.error(
																														"Error deleting this project",
																													);
																												})
																												.finally(() => {
																													utils.project.all.invalidate();
																												});
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
																</h3>
															</div>
															<div className="pt-4 mt-auto">
																<div className="space-y-1 text-xs flex flex-row justify-between max-sm:flex-wrap w-full gap-2 sm:gap-4">
																	<DateTooltip date={project.createdAt}>
																		Created
																	</DateTooltip>
																	<span>
																		{totalServices}{" "}
																		{totalServices === 1
																			? "service"
																			: "services"}
																	</span>
																</div>
															</div>
														</LayerCard>
													</Link>
												</div>
											);
										})}
									</div>
								</>
							)}
						</div>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
