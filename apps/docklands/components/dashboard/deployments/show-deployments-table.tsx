"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import {
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	AlertCircle,
	ArrowUpDown,
	Boxes,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	ExternalLink,
	Loader2,
	Rocket,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { api } from "@/client/api/trpc";
import type { AppRouter } from "@/server/api/root";
import { workspaceServicePath } from "@/shared/routes";

type DeploymentRow =
	inferRouterOutputs<AppRouter>["deployment"]["allCentralized"][number];

const statusVariants: Record<
	string,
	| "secondary"
	| "secondary"
	| "destructive"
	| "outline"
	| "warning"
	| "green"
	| "red"
> = {
	running: "warning",
	done: "green",
	error: "red",
	cancelled: "outline",
};

const statusDotClass: Record<string, string> = {
	running: "bg-amber-500",
	done: "bg-emerald-500",
	error: "bg-red-500",
	cancelled: "bg-muted-foreground/50",
};

function getServiceInfo(d: DeploymentRow) {
	const app = d.application;
	const comp = d.compose;
	if (app?.environment?.project && app.environment) {
		return {
			type: "Application" as const,
			name: app.name,
			projectId: app.environment.project.projectId,
			environmentId: app.environment.environmentId,
			projectName: app.environment.project.name,
			environmentName: app.environment.name,
			serviceId: app.applicationId,
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
			type: "Compose" as const,
			name: comp.name,
			projectId: comp.environment.project.projectId,
			environmentId: comp.environment.environmentId,
			projectName: comp.environment.project.name,
			environmentName: comp.environment.name,
			serviceId: comp.composeId,
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

function DeploymentMetricCard({
	label,
	value,
	detail,
	icon,
}: {
	label: string;
	value: number | string;
	detail: string;
	icon: ReactNode;
}) {
	return (
		<div className="rounded-md border bg-background p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="text-xs uppercase text-muted-foreground">{label}</p>
					<p className="text-2xl font-semibold tabular-nums">{value}</p>
				</div>
				<div className="flex size-9 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground">
					{icon}
				</div>
			</div>
			<p className="mt-3 text-xs text-muted-foreground">{detail}</p>
		</div>
	);
}

export function ShowDeploymentsTable() {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "createdAt", desc: true },
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 50,
	});

	const { data: deploymentsList, isLoading } =
		api.deployment.allCentralized.useQuery(undefined, {
			refetchInterval: 5000,
		});

	const filteredData = useMemo(() => {
		if (!deploymentsList) return [];
		let list = deploymentsList;
		if (statusFilter !== "all") {
			list = list.filter((d) => d.status === statusFilter);
		}
		if (typeFilter === "application") {
			list = list.filter((d) => d.applicationId != null);
		} else if (typeFilter === "compose") {
			list = list.filter((d) => d.composeId != null);
		}
		if (globalFilter.trim()) {
			const q = globalFilter.toLowerCase();
			list = list.filter((d) => {
				const info = getServiceInfo(d);
				if (!info) return false;
				return (
					info.name.toLowerCase().includes(q) ||
					info.projectName.toLowerCase().includes(q) ||
					info.environmentName.toLowerCase().includes(q) ||
					(d.title?.toLowerCase().includes(q) ?? false)
				);
			});
		}
		return list;
	}, [deploymentsList, statusFilter, typeFilter, globalFilter]);

	const deploymentStats = useMemo(() => {
		const list = deploymentsList ?? [];
		const active = list.filter((deployment) => deployment.status === "running");
		const failed = list.filter((deployment) => deployment.status === "error");
		const successful = list.filter(
			(deployment) => deployment.status === "done",
		);
		const latest = [...list].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)[0];

		return {
			active: active.length,
			failed: failed.length,
			successful: successful.length,
			total: list.length,
			latest,
		};
	}, [deploymentsList]);

	const recentDeploymentStream = useMemo(
		() =>
			[...filteredData]
				.sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				)
				.slice(0, 5),
		[filteredData],
	);

	const columns = useMemo(
		() => [
			{
				id: "serviceName",
				accessorFn: (row: DeploymentRow) => getServiceInfo(row)?.name ?? "",
				header: ({
					column,
				}: {
					column: {
						getIsSorted: () => false | "asc" | "desc";
						toggleSorting: (asc: boolean) => void;
					};
				}) => (
					<Button
						variant="ghost"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Service
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }: { row: { original: DeploymentRow } }) => {
					const info = getServiceInfo(row.original);
					if (!info) return <span className="text-muted-foreground">—</span>;
					return (
						<div className="flex items-center gap-2">
							{info.type === "Application" ? (
								<Rocket className="size-4 text-muted-foreground shrink-0" />
							) : (
								<Boxes className="size-4 text-muted-foreground shrink-0" />
							)}
							<div className="flex flex-col min-w-0">
								<span className="font-medium truncate">{info.name}</span>
								<Badge variant="outline" className="w-fit text-[10px]">
									{info.type}
								</Badge>
							</div>
						</div>
					);
				},
			},
			{
				id: "projectName",
				accessorFn: (row: DeploymentRow) =>
					getServiceInfo(row)?.projectName ?? "",
				header: ({
					column,
				}: {
					column: {
						getIsSorted: () => false | "asc" | "desc";
						toggleSorting: (asc: boolean) => void;
					};
				}) => (
					<Button
						variant="ghost"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Workspace
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }: { row: { original: DeploymentRow } }) => {
					const info = getServiceInfo(row.original);
					return (
						<span className="text-muted-foreground">
							{info?.projectName ?? "—"}
						</span>
					);
				},
			},
			{
				id: "environmentName",
				accessorFn: (row: DeploymentRow) =>
					getServiceInfo(row)?.environmentName ?? "",
				header: ({
					column,
				}: {
					column: {
						getIsSorted: () => false | "asc" | "desc";
						toggleSorting: (asc: boolean) => void;
					};
				}) => (
					<Button
						variant="ghost"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Environment
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }: { row: { original: DeploymentRow } }) => {
					const info = getServiceInfo(row.original);
					return (
						<span className="text-muted-foreground">
							{info?.environmentName ?? "—"}
						</span>
					);
				},
			},
			{
				accessorKey: "title",
				header: ({
					column,
				}: {
					column: {
						getIsSorted: () => false | "asc" | "desc";
						toggleSorting: (asc: boolean) => void;
					};
				}) => (
					<Button
						variant="ghost"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Title
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }: { row: { original: DeploymentRow } }) => (
					<span className="text-sm truncate max-w-[200px] block">
						{row.original.title || "—"}
					</span>
				),
			},
			{
				accessorKey: "status",
				header: ({
					column,
				}: {
					column: {
						getIsSorted: () => false | "asc" | "desc";
						toggleSorting: (asc: boolean) => void;
					};
				}) => (
					<Button
						variant="ghost"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Status
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }: { row: { original: DeploymentRow } }) => {
					const status = row.original.status ?? "running";
					return (
						<Badge variant={statusVariants[status] ?? "secondary"}>
							{status}
						</Badge>
					);
				},
			},
			{
				accessorKey: "createdAt",
				header: ({
					column,
				}: {
					column: {
						getIsSorted: () => false | "asc" | "desc";
						toggleSorting: (asc: boolean) => void;
					};
				}) => (
					<Button
						variant="ghost"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Created
						<ArrowUpDown className="ml-2 size-4" />
					</Button>
				),
				cell: ({ row }: { row: { original: DeploymentRow } }) => (
					<span className="text-muted-foreground text-sm whitespace-nowrap">
						{row.original.createdAt
							? new Date(row.original.createdAt).toLocaleString()
							: "—"}
					</span>
				),
			},
			{
				header: "",
				id: "actions",
				enableSorting: false,
				cell: ({ row }: { row: { original: DeploymentRow } }) => {
					const info = getServiceInfo(row.original);
					if (!info) return null;
					return (
						<LinkButton
							href={info.href}
							variant="ghost"
							size="sm"
							className="gap-1"
						>
							<ExternalLink className="size-4" />
							Open
						</LinkButton>
					);
				},
			},
		],
		[],
	);

	const table = useReactTable({
		data: filteredData,
		columns,
		state: {
			sorting,
			columnFilters,
			globalFilter,
			pagination,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	return (
		<div className="space-y-2">
			{!isLoading && (
				<>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<DeploymentMetricCard
							label="Active deployments"
							value={deploymentStats.active}
							detail="Deployments currently moving through the worker."
							icon={<Activity className="size-4" />}
						/>
						<DeploymentMetricCard
							label="Successful"
							value={deploymentStats.successful}
							detail="Completed deployments retained in the central timeline."
							icon={<CheckCircle2 className="size-4" />}
						/>
						<DeploymentMetricCard
							label="Failed"
							value={deploymentStats.failed}
							detail="Deployments that need attention before the next release."
							icon={<AlertCircle className="size-4" />}
						/>
						<DeploymentMetricCard
							label="Latest"
							value={
								deploymentStats.latest?.createdAt
									? formatDistanceToNow(
											new Date(deploymentStats.latest.createdAt),
											{
												addSuffix: true,
											},
										)
									: "—"
							}
							detail={`${deploymentStats.total} total deployment records`}
							icon={<Clock className="size-4" />}
						/>
					</div>

					<div className="rounded-md border bg-background">
						<div className="flex items-center justify-between gap-3 border-b px-4 py-3">
							<div>
								<p className="text-sm font-medium">Deployment stream</p>
								<p className="text-xs text-muted-foreground">
									Latest runtime changes across every project and environment.
								</p>
							</div>
							<Badge variant="outline">{filteredData.length} visible</Badge>
						</div>
						{recentDeploymentStream.length === 0 ? (
							<div className="flex min-h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
								<Rocket className="size-6" />
								<p className="text-sm">
									No deployment activity matches this view.
								</p>
							</div>
						) : (
							<div className="divide-y">
								{recentDeploymentStream.map((deployment) => {
									const info = getServiceInfo(deployment);
									const status = deployment.status ?? "running";
									return (
										<div
											key={deployment.deploymentId}
											className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
										>
											<div className="flex min-w-0 items-start gap-3">
												<span
													className={`mt-2 size-2 shrink-0 rounded-full ${statusDotClass[status] ?? statusDotClass.cancelled}`}
													aria-hidden="true"
												/>
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2">
														<p className="truncate text-sm font-medium">
															{info?.name ?? "Unknown service"}
														</p>
														<Badge
															variant={statusVariants[status] ?? "secondary"}
														>
															{status}
														</Badge>
														{info && (
															<Badge variant="outline">{info.type}</Badge>
														)}
													</div>
													<p className="mt-1 truncate text-xs text-muted-foreground">
														{info
															? `${info.projectName} / ${info.environmentName}`
															: "Service metadata unavailable"}
														{deployment.title ? ` · ${deployment.title}` : ""}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3 md:justify-end">
												<span className="text-xs text-muted-foreground">
													{deployment.createdAt
														? formatDistanceToNow(
																new Date(deployment.createdAt),
																{
																	addSuffix: true,
																},
															)
														: "—"}
												</span>
												{info && (
													<LinkButton
														href={info.href}
														variant="ghost"
														size="sm"
													>
														<ExternalLink className="size-4" />
														Open
													</LinkButton>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<Input
					placeholder="Search by name, project, environment, or title..."
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					className="max-w-xs"
				/>
				<Select
					aria-label="Deployment status filter"
					value={statusFilter}
					onValueChange={(value) =>
						value !== null && setStatusFilter(value as never)
					}
				>
					<></>
					<>
						<Select.Option value="all">All statuses</Select.Option>
						<Select.Option value="running">Running</Select.Option>
						<Select.Option value="done">Done</Select.Option>
						<Select.Option value="error">Error</Select.Option>
						<Select.Option value="cancelled">Cancelled</Select.Option>
					</>
				</Select>
				<Select
					aria-label="Deployment service type filter"
					value={typeFilter}
					onValueChange={(value) =>
						value !== null && setTypeFilter(value as never)
					}
				>
					<></>
					<>
						<Select.Option value="all">All types</Select.Option>
						<Select.Option value="application">Application</Select.Option>
						<Select.Option value="compose">Compose</Select.Option>
					</>
				</Select>
			</div>
			<div className="px-0">
				{isLoading ? (
					<div className="flex gap-4 w-full items-center justify-center min-h-[45vh] text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						<span>Loading deployments...</span>
					</div>
				) : (
					<>
						<div className="rounded-md border overflow-x-auto">
							<Table>
								<Table.Header>
									{table.getHeaderGroups().map((headerGroup) => (
										<Table.Row key={headerGroup.id}>
											{headerGroup.headers.map((header) => (
												<Table.Head key={header.id}>
													{header.isPlaceholder
														? null
														: flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)}
												</Table.Head>
											))}
										</Table.Row>
									))}
								</Table.Header>
								<Table.Body>
									{table.getRowModel().rows?.length ? (
										table.getRowModel().rows.map((row) => (
											<Table.Row key={row.id}>
												{row.getVisibleCells().map((cell) => (
													<Table.Cell key={cell.id}>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</Table.Cell>
												))}
											</Table.Row>
										))
									) : (
										<Table.Row>
											<Table.Cell
												colSpan={columns.length}
												className=" text-center"
											>
												<div className="flex flex-col min-h-[45vh] items-center justify-center gap-2 text-muted-foreground">
													<Rocket className="size-8" />
													<p className="font-medium">No deployments found</p>
													<p className="text-sm">
														Deployment records from applications and compose
														will appear here.
													</p>
												</div>
											</Table.Cell>
										</Table.Row>
									)}
								</Table.Body>
							</Table>
						</div>
						<div className="flex flex-col gap-4 px-4 py-4 border-t sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-2 flex-wrap">
								<span className="text-sm text-muted-foreground whitespace-nowrap">
									Rows per page
								</span>
								<Select
									aria-label="Deployment rows per page"
									value={String(pagination.pageSize)}
									onValueChange={(value) => {
										if (value === null) return;
										setPagination((p) => ({
											...p,
											pageSize: Number(value),
											pageIndex: 0,
										}));
									}}
								>
									<></>
									<>
										{[10, 25, 50, 100].map((size) => (
											<Select.Option key={size} value={String(size)}>
												{size}
											</Select.Option>
										))}
									</>
								</Select>
								<span className="text-sm text-muted-foreground whitespace-nowrap">
									Showing{" "}
									{filteredData.length === 0
										? 0
										: pagination.pageIndex * pagination.pageSize + 1}{" "}
									to{" "}
									{Math.min(
										(pagination.pageIndex + 1) * pagination.pageSize,
										filteredData.length,
									)}{" "}
									of {filteredData.length} entries
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="h-8"
									onClick={() => table.previousPage()}
									disabled={!table.getCanPreviousPage()}
								>
									<ChevronLeft className="size-4" />
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="h-8"
									onClick={() => table.nextPage()}
									disabled={!table.getCanNextPage()}
								>
									Next
									<ChevronRight className="size-4" />
								</Button>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
