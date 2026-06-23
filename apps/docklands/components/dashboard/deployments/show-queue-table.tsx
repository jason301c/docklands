"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { LinkButton } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
import type { inferRouterOutputs } from "@trpc/server";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	AlertCircle,
	ArrowRight,
	Clock,
	ListTodo,
	Loader2,
	TimerReset,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { api } from "@/client/api/trpc";
import type { AppRouter } from "@/server/api/root";

type QueueRow =
	inferRouterOutputs<AppRouter>["deployment"]["queueList"][number];

const stateVariants: Record<
	string,
	| "secondary"
	| "secondary"
	| "destructive"
	| "outline"
	| "warning"
	| "green"
	| "red"
> = {
	pending: "secondary",
	waiting: "secondary",
	active: "warning",
	delayed: "outline",
	completed: "green",
	failed: "destructive",
	cancelled: "outline",
	paused: "outline",
};

function formatTs(ts?: number): string {
	if (ts == null) return "—";
	const d = new Date(ts);
	return d.toLocaleString();
}

function formatRelativeTs(ts?: number): string {
	if (ts == null) return "—";
	return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

function getJobLabel(row: QueueRow): string {
	const d = row.data as {
		applicationType?: string;
		applicationId?: string;
		composeId?: string;
		previewDeploymentId?: string;
		titleLog?: string;
		type?: string;
	};
	if (!d) return String(row.id);
	const type = d.applicationType ?? "job";
	const title = d.titleLog ?? "";
	if (title) return title;
	if (d.applicationId) return `Application ${d.applicationId.slice(0, 8)}…`;
	if (d.composeId) return `Compose ${d.composeId.slice(0, 8)}…`;
	if (d.previewDeploymentId)
		return `Preview ${d.previewDeploymentId.slice(0, 8)}…`;
	return `${type} ${String(row.id)}`;
}

function QueueMetricCard({
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

export function ShowDeploymentQueueTable(props: { embedded?: boolean }) {
	const { embedded: _embedded = false } = props;
	const { data: queueList, isLoading } = api.deployment.queueList.useQuery(
		undefined,
		{ refetchInterval: 3000 },
	);

	const queueStats = useMemo(() => {
		const rows = queueList ?? [];
		const active = rows.filter((row) => row.state === "active").length;
		const waiting = rows.filter((row) =>
			["pending", "waiting", "delayed", "paused"].includes(row.state),
		).length;
		const failed = rows.filter((row) => String(row.state) === "failed").length;
		const latest = [...rows].sort(
			(a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
		)[0];

		return {
			active,
			waiting,
			failed,
			total: rows.length,
			latest,
		};
	}, [queueList]);

	const queueStream = useMemo(
		() =>
			[...(queueList ?? [])]
				.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
				.slice(0, 5),
		[queueList],
	);

	return (
		<div className="space-y-2 px-0">
			{isLoading ? (
				<div className="flex gap-4 w-full items-center justify-center min-h-[30vh] text-kumo-subtle">
					<Loader2 className="size-4 animate-spin" />
					<span>Loading queue...</span>
				</div>
			) : (
				<>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<QueueMetricCard
							label="Active"
							value={queueStats.active}
							detail="Workers currently processing deployment jobs."
							icon={<Activity className="size-4" />}
						/>
						<QueueMetricCard
							label="Waiting"
							value={queueStats.waiting}
							detail="Jobs queued, delayed, or paused before execution."
							icon={<TimerReset className="size-4" />}
						/>
						<QueueMetricCard
							label="Failed"
							value={queueStats.failed}
							detail="Queue jobs that failed before completion."
							icon={<AlertCircle className="size-4" />}
						/>
						<QueueMetricCard
							label="Latest"
							value={formatRelativeTs(queueStats.latest?.timestamp)}
							detail={`${queueStats.total} total jobs in queue history`}
							icon={<Clock className="size-4" />}
						/>
					</div>

					<div className="rounded-md border bg-kumo-canvas">
						<div className="flex items-center justify-between gap-3 border-b px-4 py-3">
							<div>
								<p className="text-sm font-medium">Worker queue</p>
								<p className="text-xs text-kumo-subtle">
									Most recent deployment jobs observed by the worker.
								</p>
							</div>
							<Badge variant="outline">{queueStats.total} jobs</Badge>
						</div>
						{queueStream.length === 0 ? (
							<div className="flex min-h-32 flex-col items-center justify-center gap-2 text-kumo-subtle">
								<ListTodo className="size-6" />
								<p className="text-sm">Queue is empty.</p>
							</div>
						) : (
							<div className="divide-y">
								{queueStream.map((row) => {
									const d = row.data as Record<string, unknown>;
									const appType = d?.applicationType as string | undefined;
									const pathInfo = row.servicePath;
									return (
										<div
											key={String(row.id)}
											className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
										>
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<p className="truncate text-sm font-medium">
														{getJobLabel(row)}
													</p>
													<Badge
														variant={stateVariants[row.state] ?? "outline"}
													>
														{row.state}
													</Badge>
													<Badge variant="outline">
														{appType ?? row.name ?? "job"}
													</Badge>
												</div>
												<p className="mt-1 truncate text-xs text-kumo-subtle">
													Job {String(row.id)} · added{" "}
													{formatRelativeTs(row.timestamp)}
													{row.failedReason ? ` · ${row.failedReason}` : ""}
												</p>
											</div>
											<div className="flex items-center gap-2 md:justify-end">
												{pathInfo?.href ? (
													<LinkButton
														href={pathInfo.href}
														variant="ghost"
														size="sm"
													>
														<ArrowRight className="size-4" />
														Service
													</LinkButton>
												) : (
													<span className="text-xs text-kumo-subtle">—</span>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>

					<div className="rounded-md border overflow-x-auto">
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>Job ID</Table.Head>
									<Table.Head>Label</Table.Head>
									<Table.Head>Type</Table.Head>
									<Table.Head>State</Table.Head>
									<Table.Head>Added</Table.Head>
									<Table.Head>Processed</Table.Head>
									<Table.Head>Finished</Table.Head>
									<Table.Head>Error</Table.Head>
									<Table.Head className="w-[100px]">Actions</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{queueList?.length ? (
									queueList.map((row) => {
										const d = row.data as Record<string, unknown>;
										const appType = d?.applicationType as string | undefined;
										const pathInfo = row.servicePath;
										const hasLink = pathInfo?.href != null;
										return (
											<Table.Row key={String(row.id)}>
												<Table.Cell className="font-mono text-xs">
													{String(row.id)}
												</Table.Cell>
												<Table.Cell className="max-w-[200px] truncate">
													{getJobLabel(row)}
												</Table.Cell>
												<Table.Cell>{appType ?? row.name ?? "—"}</Table.Cell>
												<Table.Cell>
													<Badge
														variant={stateVariants[row.state] ?? "outline"}
													>
														{row.state}
													</Badge>
												</Table.Cell>
												<Table.Cell className="text-kumo-subtle text-xs">
													{formatTs(row.timestamp)}
												</Table.Cell>
												<Table.Cell className="text-kumo-subtle text-xs">
													{formatTs(row.processedOn)}
												</Table.Cell>
												<Table.Cell className="text-kumo-subtle text-xs">
													{formatTs(row.finishedOn)}
												</Table.Cell>
												<Table.Cell className="max-w-[180px] truncate text-xs text-kumo-danger">
													{row.failedReason ?? "—"}
												</Table.Cell>
												<Table.Cell>
													<div className="flex items-center gap-1">
														{hasLink ? (
															<LinkButton
																href={pathInfo!.href!}
																variant="ghost"
																size="sm"
															>
																<ArrowRight className="size-4 mr-1" />
																Service
															</LinkButton>
														) : (
															<span className="text-kumo-subtle text-xs">
																—
															</span>
														)}
													</div>
												</Table.Cell>
											</Table.Row>
										);
									})
								) : (
									<Table.Row>
										<Table.Cell colSpan={9} className="text-center py-12">
											<div className="flex flex-col items-center justify-center gap-2 text-kumo-subtle min-h-[30vh]">
												<ListTodo className="size-8" />
												<p className="font-medium">Queue is empty</p>
												<p className="text-sm">
													Deployment jobs will appear here when they are queued.
												</p>
											</div>
										</Table.Cell>
									</Table.Row>
								)}
							</Table.Body>
						</Table>
					</div>
				</>
			)}
		</div>
	);
}
