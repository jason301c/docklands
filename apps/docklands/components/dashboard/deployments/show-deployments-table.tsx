"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Boxes,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	ExternalLink,
	Rocket,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { Select } from "@/components/shared/select";
import {
	EmptyState,
	ErrorState,
	LoadingState,
} from "@/components/shared/states";
import { cn } from "@/shared/utils";
import { DeploymentDetailDrawer } from "./deployment-detail-drawer";
import {
	type DeploymentRow,
	formatDeploymentDuration,
	formatDurationSeconds,
	getDeploymentTrigger,
	getServiceInfo,
	statusDotClass,
	statusLabel,
	statusVariants,
} from "./deployments-columns";
import {
	type DeploymentSortField,
	type DeploymentStatusFilter,
	useDeploymentsTable,
} from "./use-deployments-table";

function StatCard({
	label,
	value,
	detail,
	icon,
	active,
	onClick,
}: {
	label: string;
	value: ReactNode;
	detail: string;
	icon: ReactNode;
	active?: boolean;
	onClick?: () => void;
}) {
	const body = (
		<>
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
		</>
	);

	if (!onClick) {
		return <div className="rounded-md border bg-kumo-canvas p-4">{body}</div>;
	}
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"rounded-md border bg-kumo-canvas p-4 text-left transition-colors hover:border-kumo-brand/60",
				active && "border-kumo-brand ring-1 ring-kumo-brand",
			)}
		>
			{body}
		</button>
	);
}

function SortHeader({
	label,
	field,
	sortBy,
	sortDir,
	onToggle,
}: {
	label: string;
	field: DeploymentSortField;
	sortBy: DeploymentSortField;
	sortDir: "asc" | "desc";
	onToggle: (field: DeploymentSortField) => void;
}) {
	const active = sortBy === field;
	return (
		<Button
			variant="ghost"
			className="-ml-3 h-8"
			onClick={() => onToggle(field)}
		>
			{label}
			{active ? (
				sortDir === "asc" ? (
					<ArrowUp className="ml-2 size-4" />
				) : (
					<ArrowDown className="ml-2 size-4" />
				)
			) : (
				<ArrowUpDown className="ml-2 size-4 opacity-50" />
			)}
		</Button>
	);
}

function StatusCell({ status }: { status: string }) {
	const isRunning = status === "running";
	return (
		<div className="flex items-center gap-2">
			<span
				className={cn(
					"size-2 shrink-0 rounded-full",
					statusDotClass[status] ?? statusDotClass.cancelled,
					isRunning && "animate-pulse",
				)}
				aria-hidden="true"
			/>
			<Badge variant={statusVariants[status] ?? "secondary"}>
				{statusLabel[status] ?? status}
			</Badge>
		</div>
	);
}

/** A duration that ticks every second while a deployment is in flight. */
function LiveElapsed({ startedAt }: { startedAt: string | null }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);
	if (!startedAt) return <span className="tabular-nums">starting…</span>;
	const seconds = Math.max(
		0,
		Math.floor((now - new Date(startedAt).getTime()) / 1000),
	);
	return <span className="tabular-nums">{formatDurationSeconds(seconds)}</span>;
}

/**
 * Pinned band of currently-running deployments. Lives above the history feed so
 * "what's happening now" is always the first thing on the page; collapses to
 * nothing when nothing is in flight.
 */
function InFlightBand({
	rows,
	onSelect,
}: {
	rows: DeploymentRow[];
	onSelect: (row: DeploymentRow) => void;
}) {
	if (rows.length === 0) return null;
	return (
		<div className="overflow-hidden rounded-md border border-kumo-warning/40 bg-kumo-warning/5">
			<div className="flex items-center gap-2 border-b border-kumo-warning/30 px-4 py-2.5">
				<span className="relative flex size-2">
					<span className="absolute inline-flex size-full animate-ping rounded-full bg-kumo-warning opacity-75" />
					<span className="relative inline-flex size-2 rounded-full bg-kumo-warning" />
				</span>
				<span className="text-sm font-medium">In flight</span>
				<Badge variant="warning">{rows.length}</Badge>
			</div>
			<ul className="divide-y divide-kumo-line/60">
				{rows.map((row) => {
					const info = getServiceInfo(row);
					const trigger = getDeploymentTrigger(row);
					return (
						<li key={row.deploymentId}>
							<button
								type="button"
								onClick={() => onSelect(row)}
								className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-kumo-warning/10"
							>
								{info?.type === "Compose" ? (
									<Boxes className="size-4 shrink-0 text-kumo-subtle" />
								) : (
									<Rocket className="size-4 shrink-0 text-kumo-subtle" />
								)}
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-sm font-medium">
										{info?.name ?? "Unknown service"}
									</span>
									<span className="truncate text-xs text-kumo-subtle">
										{info
											? `${info.workspaceName} · ${info.environmentName}`
											: "—"}
									</span>
								</div>
								<Badge variant={trigger.variant}>{trigger.label}</Badge>
								<span className="w-16 shrink-0 text-right text-sm text-kumo-subtle">
									<LiveElapsed startedAt={row.startedAt} />
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function ShowDeploymentsTable() {
	const t = useDeploymentsTable();
	const [selected, setSelected] = useState<DeploymentRow | null>(null);

	const showingFrom = t.total === 0 ? 0 : t.pageIndex * t.pageSize + 1;
	const showingTo = Math.min((t.pageIndex + 1) * t.pageSize, t.total);

	return (
		<div className="space-y-3">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard
					label="Active"
					value={t.counts.active}
					detail="Deployments in flight right now — pinned below."
					icon={<Activity className="size-4" />}
				/>
				<StatCard
					label="Succeeded"
					value={t.counts.successful}
					detail="Completed deployments in the central timeline."
					icon={<CheckCircle2 className="size-4" />}
					active={t.status === "done"}
					onClick={() => t.toggleStatus("done")}
				/>
				<StatCard
					label="Failed"
					value={t.counts.failed}
					detail="Deployments that need attention. Click to filter."
					icon={<AlertCircle className="size-4" />}
					active={t.status === "error"}
					onClick={() => t.toggleStatus("error")}
				/>
				<StatCard
					label="Latest"
					value={
						t.latestCreatedAt
							? formatDistanceToNow(new Date(t.latestCreatedAt), {
									addSuffix: true,
								})
							: "—"
					}
					detail={`${t.counts.total} total deployment ${
						t.counts.total === 1 ? "record" : "records"
					}`}
					icon={<Clock className="size-4" />}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Input
					aria-label="Search deployments"
					placeholder="Search by service, workspace, environment, or title..."
					value={t.searchInput}
					onChange={(e) => t.setSearchInput(e.target.value)}
					className="max-w-xs"
				/>
				<Select
					aria-label="Deployment status filter"
					value={t.status}
					onValueChange={(value) =>
						value !== null && t.setStatus(value as DeploymentStatusFilter)
					}
				>
					<></>
					<>
						<Select.Option value="all">All statuses</Select.Option>
						<Select.Option value="done">Succeeded</Select.Option>
						<Select.Option value="error">Failed</Select.Option>
						<Select.Option value="cancelled">Cancelled</Select.Option>
					</>
				</Select>
				<Select
					aria-label="Deployment service type filter"
					value={t.type}
					onValueChange={(value) =>
						value !== null &&
						t.setType(value as "all" | "application" | "compose")
					}
				>
					<></>
					<>
						<Select.Option value="all">All types</Select.Option>
						<Select.Option value="application">Application</Select.Option>
						<Select.Option value="compose">Compose</Select.Option>
					</>
				</Select>
				{t.hasFilters && (
					<Button variant="ghost" size="sm" onClick={t.clearFilters}>
						Clear filters
					</Button>
				)}
			</div>

			<InFlightBand rows={t.activeRows} onSelect={setSelected} />

			{t.query.isError ? (
				<ErrorState
					error={t.query.error}
					onRetry={() => t.query.refetch()}
					title="Failed to load deployments"
				/>
			) : t.query.isPending ? (
				<LoadingState label="Loading deployments..." />
			) : t.rows.length === 0 ? (
				<EmptyState
					icon={Rocket}
					title={
						t.hasFilters
							? "No deployments match your filters"
							: t.activeRows.length > 0
								? "No finished deployments yet"
								: "No deployments yet"
					}
					description={
						t.hasFilters
							? "Try a different search or clear the filters."
							: t.activeRows.length > 0
								? "Deployments currently in flight are pinned above; finished records will land here."
								: "Deployment records from applications and compose will appear here."
					}
					action={
						t.hasFilters ? (
							<Button variant="secondary" size="sm" onClick={t.clearFilters}>
								Clear filters
							</Button>
						) : undefined
					}
				/>
			) : (
				<>
					<div className="overflow-x-auto rounded-md border">
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>Service</Table.Head>
									<Table.Head>Workspace</Table.Head>
									<Table.Head>Environment</Table.Head>
									<Table.Head>Trigger</Table.Head>
									<Table.Head>
										<SortHeader
											label="Status"
											field="status"
											sortBy={t.sortBy}
											sortDir={t.sortDir}
											onToggle={t.toggleSort}
										/>
									</Table.Head>
									<Table.Head>Duration</Table.Head>
									<Table.Head>
										<SortHeader
											label="Created"
											field="createdAt"
											sortBy={t.sortBy}
											sortDir={t.sortDir}
											onToggle={t.toggleSort}
										/>
									</Table.Head>
									<Table.Head />
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{t.rows.map((deployment) => {
									const info = getServiceInfo(deployment);
									const status = deployment.status ?? "running";
									const trigger = getDeploymentTrigger(deployment);
									const duration = formatDeploymentDuration(
										deployment.startedAt,
										deployment.finishedAt,
									);
									return (
										<Table.Row
											key={deployment.deploymentId}
											className="cursor-pointer hover:bg-kumo-fill/50"
											onClick={() => setSelected(deployment)}
										>
											<Table.Cell>
												<div className="flex items-center gap-2">
													{info?.type === "Compose" ? (
														<Boxes className="size-4 shrink-0 text-kumo-subtle" />
													) : (
														<Rocket className="size-4 shrink-0 text-kumo-subtle" />
													)}
													<div className="flex min-w-0 flex-col">
														<span className="truncate font-medium">
															{info?.name ?? "Unknown service"}
														</span>
														{info && (
															<Badge
																variant="outline"
																className="w-fit text-[10px]"
															>
																{info.type}
															</Badge>
														)}
													</div>
												</div>
											</Table.Cell>
											<Table.Cell className="text-kumo-subtle">
												{info?.workspaceName ?? "—"}
											</Table.Cell>
											<Table.Cell className="text-kumo-subtle">
												{info?.environmentName ?? "—"}
											</Table.Cell>
											<Table.Cell>
												<Badge variant={trigger.variant}>{trigger.label}</Badge>
											</Table.Cell>
											<Table.Cell>
												<StatusCell status={status} />
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap text-sm text-kumo-subtle">
												{duration ?? (status === "running" ? "running…" : "—")}
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap text-sm text-kumo-subtle">
												{deployment.createdAt ? (
													<DateTooltip date={deployment.createdAt} />
												) : (
													"—"
												)}
											</Table.Cell>
											<Table.Cell>
												{info && (
													<LinkButton
														href={info.href}
														variant="ghost"
														size="sm"
														className="gap-1"
														onClick={(e) => e.stopPropagation()}
													>
														<ExternalLink className="size-4" />
														Open
													</LinkButton>
												)}
											</Table.Cell>
										</Table.Row>
									);
								})}
							</Table.Body>
						</Table>
					</div>

					<div className="flex flex-col gap-4 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex flex-wrap items-center gap-2">
							<span className="whitespace-nowrap text-sm text-kumo-subtle">
								Rows per page
							</span>
							<Select
								aria-label="Deployment rows per page"
								value={String(t.pageSize)}
								onValueChange={(value) => {
									if (value === null) return;
									t.setPageSize(Number(value));
								}}
							>
								<></>
								<>
									{t.pageSizes.map((size) => (
										<Select.Option key={size} value={String(size)}>
											{size}
										</Select.Option>
									))}
								</>
							</Select>
							<span className="whitespace-nowrap text-sm text-kumo-subtle">
								Showing {showingFrom} to {showingTo} of {t.total} entries
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								className="h-8"
								onClick={() => t.setPageIndex((p) => Math.max(0, p - 1))}
								disabled={!t.canPreviousPage}
							>
								<ChevronLeft className="size-4" />
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="h-8"
								onClick={() => t.setPageIndex((p) => p + 1)}
								disabled={!t.canNextPage}
							>
								Next
								<ChevronRight className="size-4" />
							</Button>
						</div>
					</div>
				</>
			)}

			<DeploymentDetailDrawer
				deployment={selected}
				open={selected !== null}
				onClose={() => setSelected(null)}
			/>
		</div>
	);
}
