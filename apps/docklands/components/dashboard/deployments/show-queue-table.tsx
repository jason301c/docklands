"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { ArrowRight, ListTodo, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { api } from "@/client/api/trpc";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
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

export function ShowQueueTable(props: { embedded?: boolean }) {
	const { embedded: _embedded = false } = props;
	const { data: queueList, isLoading } = api.deployment.queueList.useQuery(
		undefined,
		{ refetchInterval: 3000 },
	);
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const utils = api.useUtils();
	const {
		mutateAsync: cancelApplicationDeployment,
		isPending: isCancellingApp,
	} = api.application.cancelDeployment.useMutation({
		onSuccess: () => void utils.deployment.queueList.invalidate(),
	});
	const {
		mutateAsync: cancelComposeDeployment,
		isPending: isCancellingCompose,
	} = api.compose.cancelDeployment.useMutation({
		onSuccess: () => void utils.deployment.queueList.invalidate(),
	});
	const isCancelling = isCancellingApp || isCancellingCompose;

	return (
		<div className="px-0">
			{isLoading ? (
				<div className="flex gap-4 w-full items-center justify-center min-h-[30vh] text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					<span>Loading queue...</span>
				</div>
			) : (
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
												<Badge variant={stateVariants[row.state] ?? "outline"}>
													{row.state}
												</Badge>
											</Table.Cell>
											<Table.Cell className="text-muted-foreground text-xs">
												{formatTs(row.timestamp)}
											</Table.Cell>
											<Table.Cell className="text-muted-foreground text-xs">
												{formatTs(row.processedOn)}
											</Table.Cell>
											<Table.Cell className="text-muted-foreground text-xs">
												{formatTs(row.finishedOn)}
											</Table.Cell>
											<Table.Cell className="max-w-[180px] truncate text-xs text-destructive">
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
														<span className="text-muted-foreground text-xs">
															—
														</span>
													)}
													{isCloud &&
														row.state === "active" &&
														(d?.applicationId != null ||
															d?.composeId != null) && (
															<Button
																variant="ghost"
																size="sm"
																className="text-destructive hover:text-destructive"
																disabled={isCancelling}
																onClick={() => {
																	const appId =
																		typeof d.applicationId === "string"
																			? d.applicationId
																			: undefined;
																	const compId =
																		typeof d.composeId === "string"
																			? d.composeId
																			: undefined;
																	if (appId) {
																		void cancelApplicationDeployment({
																			applicationId: appId,
																		});
																	} else if (compId) {
																		void cancelComposeDeployment({
																			composeId: compId,
																		});
																	}
																}}
															>
																<XCircle className="size-4 mr-1" />
																Cancel
															</Button>
														)}
												</div>
											</Table.Cell>
										</Table.Row>
									);
								})
							) : (
								<Table.Row>
									<Table.Cell colSpan={9} className="text-center py-12">
										<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[30vh]">
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
			)}
		</div>
	);
}
