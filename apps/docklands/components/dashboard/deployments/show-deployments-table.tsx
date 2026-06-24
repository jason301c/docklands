"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	AlertCircle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	ExternalLink,
	Loader2,
	Rocket,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Select } from "@/components/shared/select";
import {
	createDeploymentsColumns,
	getServiceInfo,
	statusDotClass,
	statusVariants,
} from "./deployments-columns";
import { useDeploymentsTable } from "./use-deployments-table";

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
		<div className="rounded-md border bg-kumo-canvas p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="text-xs uppercase text-kumo-subtle">{label}</p>
					<p className="text-2xl font-semibold tabular-nums">{value}</p>
				</div>
				<div className="flex size-9 items-center justify-center rounded-md border bg-kumo-fill/30 text-kumo-subtle">
					{icon}
				</div>
			</div>
			<p className="mt-3 text-xs text-kumo-subtle">{detail}</p>
		</div>
	);
}

export function ShowDeploymentsTable() {
	const {
		isLoading,
		filteredData,
		recentDeploymentStream,
		deploymentStats,
		sorting,
		setSorting,
		columnFilters,
		setColumnFilters,
		globalFilter,
		setGlobalFilter,
		statusFilter,
		setStatusFilter,
		typeFilter,
		setTypeFilter,
		pagination,
		setPagination,
	} = useDeploymentsTable();

	const columns = useMemo(() => createDeploymentsColumns(), []);

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

					<div className="rounded-md border bg-kumo-canvas">
						<div className="flex items-center justify-between gap-3 border-b px-4 py-3">
							<div>
								<p className="text-sm font-medium">Deployment stream</p>
								<p className="text-xs text-kumo-subtle">
									Latest runtime changes across every workspace and environment.
								</p>
							</div>
							<Badge variant="outline">{filteredData.length} visible</Badge>
						</div>
						{recentDeploymentStream.length === 0 ? (
							<div className="flex min-h-32 flex-col items-center justify-center gap-2 text-kumo-subtle">
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
													<p className="mt-1 truncate text-xs text-kumo-subtle">
														{info
															? `${info.workspaceName} / ${info.environmentName}`
															: "Service metadata unavailable"}
														{deployment.title ? ` · ${deployment.title}` : ""}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3 md:justify-end">
												<span className="text-xs text-kumo-subtle">
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
					aria-label="Search deployments"
					placeholder="Search by name, workspace, environment, or title..."
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
					<div className="flex gap-4 w-full items-center justify-center min-h-[45vh] text-kumo-subtle">
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
												<div className="flex flex-col min-h-[45vh] items-center justify-center gap-2 text-kumo-subtle">
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
								<span className="text-sm text-kumo-subtle whitespace-nowrap">
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
								<span className="text-sm text-kumo-subtle whitespace-nowrap">
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
