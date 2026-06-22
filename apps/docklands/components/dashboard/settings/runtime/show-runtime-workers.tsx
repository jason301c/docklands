import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { format } from "date-fns";
import {
	Clock,
	Key,
	KeyIcon,
	Loader2,
	Network,
	ServerIcon,
	Terminal,
	Trash2,
	User,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { ShowRuntimeWorkerActions } from "./actions/show-runtime-worker-actions";
import { HandleRuntimeWorker } from "./handle-runtime-worker";
import { SetupRuntimeWorker } from "./setup-runtime-worker";
import { RuntimeTerminalModal } from "./terminal/runtime-terminal-modal";

export const ShowRuntimeWorkers = () => {
	const { data, refetch, isPending } = api.runtimeWorker.all.useQuery();
	const { mutateAsync } = api.runtimeWorker.remove.useMutation();
	const { data: sshKeys } = api.sshKey.all.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	return (
		<div className="w-full">
			<div className="mx-auto w-full max-w-5xl rounded-lg border bg-background p-6">
				<div className="">
					<h3 className="text-xl flex flex-row gap-2">
						<ServerIcon className="size-6 text-muted-foreground self-center" />
						Runtime Workers
					</h3>
					<p>Add workers to run services on remote machines.</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					{isPending ? (
						<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[25vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						<>
							{sshKeys?.length === 0 && data?.length === 0 ? (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<KeyIcon className="size-8" />
									<span className="text-base text-muted-foreground">
										No SSH keys found. Add an SSH key to start adding workers.{" "}
										<Link
											href="/dashboard/settings/ssh-keys"
											className="text-primary"
										>
											Add SSH Key
										</Link>
									</span>
								</div>
							) : (
								<>
									{data?.length === 0 ? (
										<div className="flex flex-col items-center gap-3  min-h-[25vh] justify-center">
											<ServerIcon className="size-8 self-center text-muted-foreground" />
											<span className="text-base text-muted-foreground">
												Start adding workers to run your applications across
												remote machines.
											</span>
											{permissions?.runtimeWorker.create && (
												<HandleRuntimeWorker />
											)}
										</div>
									) : (
										<div className="flex flex-col gap-4 min-h-[25vh]">
											<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
												{data?.map((runtimeWorker) => {
													const canDelete = runtimeWorker.totalSum === 0;
													const isActive =
														runtimeWorker.runtimeWorkerStatus === "active";
													const isBuildServer =
														runtimeWorker.runtimeWorkerType === "build";
													return (
														<LayerCard
															key={runtimeWorker.runtimeWorkerId}
															className="relative hover:shadow-lg transition-shadow flex flex-col bg-transparent"
														>
															<div className="pb-3">
																<div className="flex items-start justify-between gap-2">
																	<div className="flex min-w-0 items-center gap-2">
																		<ServerIcon className="size-5 shrink-0 text-muted-foreground" />
																		<h3 className="text-lg break-words min-w-0">
																			{runtimeWorker.name}
																		</h3>
																	</div>
																</div>
																<TooltipProvider>
																	<div className="flex gap-2 mt-2 flex-wrap">
																		{isCloud && (
																			<>
																				{runtimeWorker.runtimeWorkerStatus ===
																				"active" ? (
																					<Badge variant="primary">
																						{runtimeWorker.runtimeWorkerStatus}
																					</Badge>
																				) : (
																					<Tooltip
																						delay={0}
																						side="bottom"
																						className="max-w-xs"
																						content={
																							<p className="text-sm">
																								This worker is currently marked
																								inactive. Update its status or
																								connection details before
																								running services on it.
																							</p>
																						}
																						render={
																							<span className="inline-block">
																								<Badge
																									variant="error"
																									className="cursor-help"
																								>
																									{
																										runtimeWorker.runtimeWorkerStatus
																									}
																								</Badge>
																							</span>
																						}
																					/>
																				)}
																			</>
																		)}
																		<Badge
																			variant={
																				isBuildServer
																					? "secondary"
																					: "secondary"
																			}
																		>
																			{runtimeWorker.runtimeWorkerType}
																		</Badge>
																	</div>
																</TooltipProvider>
															</div>
															<div className="space-y-3 flex-1 flex flex-col">
																<div className="flex items-center gap-2 text-sm">
																	<Network className="size-4 text-muted-foreground" />
																	<span className="text-muted-foreground">
																		IP:
																	</span>
																	<Badge variant="outline">
																		{runtimeWorker.ipAddress}
																	</Badge>
																	<span className="text-muted-foreground">
																		Port:
																	</span>
																	<span className="font-medium">
																		{runtimeWorker.port}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-sm">
																	<User className="size-4 text-muted-foreground" />
																	<span className="text-muted-foreground">
																		User:
																	</span>
																	<span className="font-medium">
																		{runtimeWorker.username}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-sm">
																	<Key className="size-4 text-muted-foreground" />
																	<span className="text-muted-foreground">
																		SSH Key:
																	</span>
																	<span className="font-medium">
																		{runtimeWorker.sshKeyId ? "Yes" : "No"}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-sm pt-2 border-t">
																	<Clock className="size-4 text-muted-foreground" />
																	<span className="text-xs text-muted-foreground">
																		Created{" "}
																		{format(
																			new Date(runtimeWorker.createdAt),
																			"PPp",
																		)}
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
																							<p className="text-xs text-muted-foreground">
																								Configure and initialize your
																								runtime worker with a container
																								engine, ingress, and the
																								services Docklands needs
																							</p>
																						</div>
																					</>
																				}
																				className="max-w-xs"
																				side="bottom"
																				asChild
																			>
																				<SetupRuntimeWorker
																					runtimeWorkerId={
																						runtimeWorker.runtimeWorkerId
																					}
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
																				!isBuildServer && (
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
																										You can not delete this
																										worker because it has active
																										services.
																										<AlertBlock type="warning">
																											You have active services
																											associated with this
																											worker, please delete them
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
																										toast.error(err.message);
																									});
																							}}
																						>
																							<Button
																								aria-label={`Delete worker ${runtimeWorker.name}`}
																								variant="ghost"
																								shape="square"
																								className={`h-9 w-9 ${canDelete ? "text-destructive hover:text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:bg-muted"}`}
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
													{data && data?.length > 0 && (
														<div>
															<HandleRuntimeWorker />
														</div>
													)}
												</div>
											)}
										</div>
									)}
								</>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};
