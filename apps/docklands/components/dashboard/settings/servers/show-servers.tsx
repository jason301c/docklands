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
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { TerminalModal } from "../web-server/terminal-modal";
import { ShowServerActions } from "./actions/show-server-actions";
import { HandleServers } from "./handle-servers";
import { SetupServer } from "./setup-server";

export const ShowServers = () => {
	const { data, refetch, isPending } = api.server.all.useQuery();
	const { mutateAsync } = api.server.remove.useMutation();
	const { data: sshKeys } = api.sshKey.all.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	return (
		<div className="w-full">
			<LayerCard className="h-full  p-2.5 rounded-xl  max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md ">
					<div className="">
						<h3 className="text-xl flex flex-row gap-2">
							<ServerIcon className="size-6 text-muted-foreground self-center" />
							Servers
						</h3>
						<p>
							Add servers to deploy your applications remotely.
						</p>
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
											No SSH Keys found. Add a SSH Key to start adding servers.{" "}
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
													Start adding servers to deploy your applications
													remotely.
												</span>
												{permissions?.server.create && <HandleServers />}
											</div>
										) : (
											<div className="flex flex-col gap-4 min-h-[25vh]">
												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
													{data?.map((server) => {
														const canDelete = server.totalSum === 0;
														const isActive = server.serverStatus === "active";
														const isBuildServer = server.serverType === "build";
														return (
															<LayerCard
																key={server.serverId}
																className="relative hover:shadow-lg transition-shadow flex flex-col bg-transparent"
															>
																<div className="pb-3">
																	<div className="flex items-start justify-between gap-2">
																		<div className="flex min-w-0 items-center gap-2">
																			<ServerIcon className="size-5 shrink-0 text-muted-foreground" />
																			<h3 className="text-lg break-words min-w-0">
																				{server.name}
																			</h3>
																		</div>
																	</div>
																	<TooltipProvider>
																		<div className="flex gap-2 mt-2 flex-wrap">
																			{isCloud && (
																				<>
																					{server.serverStatus === "active" ? (
																						<Badge variant="primary">
																							{server.serverStatus}
																						</Badge>
																					) : (
																						<Tooltip delay={0} side="bottom" className="max-w-xs" content={(

																								<p className="text-sm">
																									This server is currently
																									marked inactive. Update the
																									server status or connection
																									details before deploying
																									services to it.
																								</p>
																							
)} render={(

																								<span className="inline-block">
																									<Badge
																										variant="error"
																										className="cursor-help"
																									>
																										{server.serverStatus}
																									</Badge>
																								</span>
																							
)} />
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
																				{server.serverType}
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
																			{server.ipAddress}
																		</Badge>
																		<span className="text-muted-foreground">
																			Port:
																		</span>
																		<span className="font-medium">
																			{server.port}
																		</span>
																	</div>
																	<div className="flex items-center gap-2 text-sm">
																		<User className="size-4 text-muted-foreground" />
																		<span className="text-muted-foreground">
																			User:
																		</span>
																		<span className="font-medium">
																			{server.username}
																		</span>
																	</div>
																	<div className="flex items-center gap-2 text-sm">
																		<Key className="size-4 text-muted-foreground" />
																		<span className="text-muted-foreground">
																			SSH Key:
																		</span>
																		<span className="font-medium">
																			{server.sshKeyId ? "Yes" : "No"}
																		</span>
																	</div>
																	<div className="flex items-center gap-2 text-sm pt-2 border-t">
																		<Clock className="size-4 text-muted-foreground" />
																		<span className="text-xs text-muted-foreground">
																			Created{" "}
																			{format(
																				new Date(server.createdAt),
																				"PPp",
																			)}
																		</span>
																	</div>

																	{/* Compact Actions */}
																	{isActive && (
																		<div className="flex items-center  gap-2 pt-3 border-t mt-auto flex-wrap">
																			<div className="flex items-center gap-2 w-full">
																				<Tooltip content={<>
																						<div className="space-y-1">
																							<p className="font-semibold">
																								Setup Server
																							</p>
																							<p className="text-xs text-muted-foreground">
																								Configure and initialize your
																								server with Docker, Traefik, and
																								other essential services
																							</p>
																						</div>
																					</>} className="max-w-xs"
																						side="bottom"  asChild>
																						<SetupServer
																							serverId={server.serverId}
																						/>
																					</Tooltip>
																			</div>

																			<TooltipProvider>
																				{server.sshKeyId && (
																					<Tooltip content={<>
																							<p>Terminal</p>
																						</>}  asChild>
																							<div>
																								<TerminalModal
																									serverId={server.serverId}
																									asButton={true}
																								>
																									<Button aria-label="Action"
																										variant="outline"
																										shape="square"
																										className="h-9 w-9"
																									>
																										<Terminal className="h-4 w-4" />
																									</Button>
																								</TerminalModal>
																							</div>
																						</Tooltip>
																				)}

																				<Tooltip content={<>
																						<p>Edit Server</p>
																					</>}  asChild>
																						<div>
																							<HandleServers
																								serverId={server.serverId}
																								asButton={true}
																							/>
																						</div>
																					</Tooltip>

																				{server.sshKeyId && !isBuildServer && (
																					<Tooltip content={<>
																							<p>Web Server Actions</p>
																						</>}  asChild>
																							<div>
																								<ShowServerActions
																									serverId={server.serverId}
																									asButton={true}
																								/>
																							</div>
																						</Tooltip>
																				)}

																				<div className="flex-1" />

																				{permissions?.server.delete && (
																					<Tooltip content={<>
																							<p>
																								{canDelete
																									? "Delete Server"
																									: "Cannot delete - has active services"}
																							</p>
																						</>}  asChild>
																							<div>
																								<DialogAction
																									disabled={!canDelete}
																									title={
																										canDelete
																											? "Delete Server"
																											: "Server has active services"
																									}
																									description={
																										canDelete ? (
																											"This will delete the server and all associated data"
																										) : (
																											<div className="flex flex-col gap-2">
																												You can not delete this
																												server because it has
																												active services.
																												<AlertBlock type="warning">
																													You have active
																													services associated
																													with this server,
																													please delete them
																													first.
																												</AlertBlock>
																											</div>
																										)
																									}
																									onClick={async () => {
																										await mutateAsync({
																											serverId: server.serverId,
																										})
																											.then(() => {
																												refetch();
																												toast.success(
																													`Server ${server.name} deleted successfully`,
																												);
																											})
																											.catch((err) => {
																												toast.error(
																													err.message,
																												);
																											});
																									}}
																								>
																									<Button aria-label="Delete"
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

												{permissions?.server.create && (
													<div className="flex flex-row gap-2 flex-wrap w-full justify-end mt-4">
														{data && data?.length > 0 && (
															<div>
																<HandleServers />
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
			</LayerCard>
		</div>
	);
};
