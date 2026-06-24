"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { format } from "date-fns";
import {
	Clock,
	Key,
	KeyIcon,
	Network,
	ServerIcon,
	Terminal,
	Trash2,
	User,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/client/api/trpc";
import { useCurrentUser } from "@/client/hooks/use-current-user";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";

const logger = createClientLogger("runtime-workers");

import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { ShowRuntimeWorkerActions } from "./actions/show-runtime-worker-actions";
import { ToggleRemoteWorkersOnly } from "./actions/toggle-remote-workers-only";
import { HandleRuntimeWorker } from "./handle-runtime-worker";
import { SetupRuntimeWorker } from "./setup-runtime-worker";
import { RuntimeTerminalModal } from "./terminal/runtime-terminal-modal";

export const ShowRuntimeWorkers = () => {
	const runtimeWorkersQuery = api.runtimeWorker.all.useQuery();
	const { refetch } = runtimeWorkersQuery;
	const { mutateAsync } = api.runtimeWorker.remove.useMutation();
	const { data: sshKeys } = api.sshKey.all.useQuery();
	const { permissions } = usePermissions();
	const { isOwnerOrAdmin: isAdmin } = useCurrentUser();

	return (
		<SectionCard
			title="Runtime Workers"
			actions={isAdmin ? <ToggleRemoteWorkersOnly /> : null}
		>
			<QueryState
				query={runtimeWorkersQuery}
				isEmpty={(data) => data.length === 0}
				empty={
					sshKeys?.length === 0 ? (
						<EmptyState
							icon={KeyIcon}
							title={
								<>
									No SSH keys found. Add an SSH key to start adding workers.{" "}
									<Link
										href="/dashboard/settings/ssh-keys"
										className="text-kumo-brand"
									>
										Add SSH Key
									</Link>
								</>
							}
						/>
					) : (
						<EmptyState
							icon={ServerIcon}
							title="Start adding workers to run your applications across remote machines."
							action={
								permissions?.runtimeWorker.create ? (
									<HandleRuntimeWorker />
								) : null
							}
						/>
					)
				}
			>
				{(data) => (
					<div className="flex flex-col gap-4 min-h-[25vh]">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{data.map((runtimeWorker) => {
								const canDelete = runtimeWorker.totalSum === 0;
								const isActive = runtimeWorker.runtimeWorkerStatus === "active";
								const isBuildRuntimeWorker =
									runtimeWorker.runtimeWorkerType === "build";
								return (
									<LayerCard
										key={runtimeWorker.runtimeWorkerId}
										className="relative hover:shadow-lg transition-shadow flex flex-col bg-transparent"
									>
										<div className="pb-3">
											<div className="flex items-start justify-between gap-2">
												<div className="flex min-w-0 items-center gap-2">
													<ServerIcon className="size-5 shrink-0 text-kumo-subtle" />
													<h3 className="text-lg break-words min-w-0">
														{runtimeWorker.name}
													</h3>
												</div>
											</div>
											<TooltipProvider>
												<div className="flex gap-2 mt-2 flex-wrap">
													<Badge
														variant={
															isBuildRuntimeWorker ? "secondary" : "secondary"
														}
													>
														{runtimeWorker.runtimeWorkerType}
													</Badge>
												</div>
											</TooltipProvider>
										</div>
										<div className="space-y-3 flex-1 flex flex-col">
											<div className="flex items-center gap-2 text-sm">
												<Network className="size-4 text-kumo-subtle" />
												<span className="text-kumo-subtle">IP:</span>
												<Badge variant="outline">
													{runtimeWorker.ipAddress}
												</Badge>
												<span className="text-kumo-subtle">Port:</span>
												<span className="font-medium">
													{runtimeWorker.port}
												</span>
											</div>
											<div className="flex items-center gap-2 text-sm">
												<User className="size-4 text-kumo-subtle" />
												<span className="text-kumo-subtle">User:</span>
												<span className="font-medium">
													{runtimeWorker.username}
												</span>
											</div>
											<div className="flex items-center gap-2 text-sm">
												<Key className="size-4 text-kumo-subtle" />
												<span className="text-kumo-subtle">SSH Key:</span>
												<span className="font-medium">
													{runtimeWorker.sshKeyId ? "Yes" : "No"}
												</span>
											</div>
											<div className="flex items-center gap-2 text-sm pt-2 border-t">
												<Clock className="size-4 text-kumo-subtle" />
												<span className="text-xs text-kumo-subtle">
													Created{" "}
													{format(new Date(runtimeWorker.createdAt), "PPp")}
												</span>
											</div>

											{/* Compact Actions */}
											{isActive && (
												<div className="flex items-center  gap-2 pt-3 border-t mt-auto flex-wrap">
													<div className="flex items-center gap-2 w-full">
														<Tooltip
															content={
																<>
																	<div className="space-y-1">
																		<p className="font-semibold">
																			Set Up Worker
																		</p>
																		<p className="text-xs text-kumo-subtle">
																			Configure and initialize your runtime
																			worker with a container engine, ingress,
																			and the services Docklands needs
																		</p>
																	</div>
																</>
															}
															className="max-w-xs"
															side="bottom"
															asChild
														>
															<SetupRuntimeWorker
																runtimeWorkerId={runtimeWorker.runtimeWorkerId}
															/>
														</Tooltip>
													</div>

													<TooltipProvider>
														{runtimeWorker.sshKeyId && (
															<Tooltip
																content={
																	<>
																		<p>Terminal</p>
																	</>
																}
																asChild
															>
																<div>
																	<RuntimeTerminalModal
																		runtimeWorkerId={
																			runtimeWorker.runtimeWorkerId
																		}
																		asButton={true}
																	>
																		<Button
																			aria-label="Open worker terminal"
																			variant="outline"
																			shape="square"
																			className="h-9 w-9"
																		>
																			<Terminal className="h-4 w-4" />
																		</Button>
																	</RuntimeTerminalModal>
																</div>
															</Tooltip>
														)}

														<Tooltip
															content={
																<>
																	<p>Edit worker</p>
																</>
															}
															asChild
														>
															<div>
																<HandleRuntimeWorker
																	runtimeWorkerId={
																		runtimeWorker.runtimeWorkerId
																	}
																	asButton={true}
																/>
															</div>
														</Tooltip>

														{runtimeWorker.sshKeyId &&
															!isBuildRuntimeWorker && (
																<Tooltip
																	content={
																		<>
																			<p>Ingress runtime actions</p>
																		</>
																	}
																	asChild
																>
																	<div>
																		<ShowRuntimeWorkerActions
																			runtimeWorkerId={
																				runtimeWorker.runtimeWorkerId
																			}
																			asButton={true}
																		/>
																	</div>
																</Tooltip>
															)}

														<div className="flex-1" />

														{permissions?.runtimeWorker.delete && (
															<Tooltip
																content={
																	<>
																		<p>
																			{canDelete
																				? "Delete Worker"
																				: "Cannot delete - has active services"}
																		</p>
																	</>
																}
																asChild
															>
																<div>
																	<DialogAction
																		disabled={!canDelete}
																		title={
																			canDelete
																				? "Delete Worker"
																				: "Worker has active services"
																		}
																		description={
																			canDelete ? (
																				"This will delete the worker and all associated data"
																			) : (
																				<div className="flex flex-col gap-2">
																					You can not delete this worker because
																					it has active services.
																					<AlertBlock type="warning">
																						You have active services associated
																						with this worker, please delete them
																						first.
																					</AlertBlock>
																				</div>
																			)
																		}
																		onClick={async () => {
																			await mutateAsync({
																				runtimeWorkerId:
																					runtimeWorker.runtimeWorkerId,
																			})
																				.then(() => {
																					refetch();
																					toast.success(
																						`Worker ${runtimeWorker.name} deleted successfully`,
																					);
																				})
																				.catch((err) => {
																					logger.error(err);
																					toast.error(err.message);
																				});
																		}}
																	>
																		<Button
																			aria-label={`Delete worker ${runtimeWorker.name}`}
																			variant="ghost"
																			shape="square"
																			className={`h-9 w-9 ${canDelete ? "text-kumo-danger hover:text-kumo-danger hover:bg-kumo-danger/10" : "text-kumo-subtle hover:bg-kumo-fill"}`}
																		>
																			<Trash2 className="h-4 w-4" />
																		</Button>
																	</DialogAction>
																</div>
															</Tooltip>
														)}
													</TooltipProvider>
												</div>
											)}
										</div>
									</LayerCard>
								);
							})}
						</div>

						{permissions?.runtimeWorker.create && (
							<div className="flex flex-row gap-2 flex-wrap w-full justify-end mt-4">
								{data.length > 0 && (
									<div>
										<HandleRuntimeWorker />
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
};
