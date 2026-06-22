import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { Ban, CheckCircle2, RefreshCcw, Rocket, Terminal } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { DialogAction } from "@/components/shared/dialog-action";
import { DrawerLogs } from "@/components/shared/drawer-logs";
import { toast } from "@/components/shared/toast";
import { type LogLine, parseLogs } from "../../container-runtime/logs/utils";
import { DockerTerminalModal } from "../../settings/web-server/docker-terminal-modal";

interface Props {
	mongoId: string;
}

export const ShowGeneralMongo = ({ mongoId }: Props) => {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canDeploy = permissions?.deployment.create ?? false;
	const { data, refetch } = api.mongo.one.useQuery(
		{
			mongoId,
		},
		{ enabled: !!mongoId },
	);

	const { mutateAsync: reload, isPending: isReloading } =
		api.mongo.reload.useMutation();

	const { mutateAsync: start, isPending: isStarting } =
		api.mongo.start.useMutation();

	const { mutateAsync: stop, isPending: isStopping } =
		api.mongo.stop.useMutation();

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);
	api.mongo.deployWithLogs.useSubscription(
		{
			mongoId: mongoId,
		},
		{
			enabled: isDeploying,
			onData(log) {
				if (!isDrawerOpen) {
					setIsDrawerOpen(true);
				}

				if (log === "Deployment completed successfully!") {
					setIsDeploying(false);
				}

				const parsedLogs = parseLogs(log);
				setFilteredLogs((prev) => [...prev, ...parsedLogs]);
			},
			onError(error) {
				console.error("Deployment logs error:", error);
				setIsDeploying(false);
			},
		},
	);
	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<LayerCard className="bg-background">
					<div>
						<h3 className="text-xl">Runtime Setup</h3>
					</div>
					<div className="flex flex-row gap-4 flex-wrap">
						<TooltipProvider delay={0}>
							{canDeploy && (
								<DialogAction
									title="Provision MongoDB"
									description="Are you sure you want to provision this MongoDB database?"
									type="default"
									onClick={async () => {
										setIsDeploying(true);
										await new Promise((resolve) => setTimeout(resolve, 1000));
										refetch();
									}}
								>
									<Button
										variant="primary"
										loading={data?.applicationStatus === "running"}
										className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										<Tooltip
											content={
												<>
													<p>Downloads and sets up the MongoDB database</p>
												</>
											}
											className="z-[60]"
											asChild
										>
											<div className="flex items-center">
												<Rocket className="size-4 mr-1" />
												Provision
											</div>
										</Tooltip>
									</Button>
								</DialogAction>
							)}
							{canDeploy && (
								<DialogAction
									title="Reload Mongo"
									description="Are you sure you want to reload this MongoDB database?"
									type="default"
									onClick={async () => {
										await reload({
											mongoId: mongoId,
											appName: data?.appName || "",
										})
											.then(() => {
												toast.success("Mongo reloaded successfully");
												refetch();
											})
											.catch(() => {
												toast.error("Error reloading Mongo");
											});
									}}
								>
									<Button
										variant="secondary"
										loading={isReloading}
										className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										<Tooltip
											content={
												<>
													<p>Restart the MongoDB service without rebuilding</p>
												</>
											}
											className="z-[60]"
											asChild
										>
											<div className="flex items-center">
												<RefreshCcw className="size-4 mr-1" />
												Reload
											</div>
										</Tooltip>
									</Button>
								</DialogAction>
							)}
							{canDeploy &&
								(data?.applicationStatus === "idle" ? (
									<DialogAction
										title="Start Mongo"
										description="Are you sure you want to start this MongoDB database?"
										type="default"
										onClick={async () => {
											await start({
												mongoId: mongoId,
											})
												.then(() => {
													toast.success("Mongo started successfully");
													refetch();
												})
												.catch(() => {
													toast.error("Error starting Mongo");
												});
										}}
									>
										<Button
											variant="secondary"
											loading={isStarting}
											className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
										>
											<Tooltip
												content={
													<>
														<p>
															Start the MongoDB database (requires a previous
															successful setup)
														</p>
													</>
												}
												className="z-[60]"
												asChild
											>
												<div className="flex items-center">
													<CheckCircle2 className="size-4 mr-1" />
													Start
												</div>
											</Tooltip>
										</Button>
									</DialogAction>
								) : (
									<DialogAction
										title="Stop Mongo"
										description="Are you sure you want to stop this MongoDB database?"
										onClick={async () => {
											await stop({
												mongoId: mongoId,
											})
												.then(() => {
													toast.success("Mongo stopped successfully");
													refetch();
												})
												.catch(() => {
													toast.error("Error stopping Mongo");
												});
										}}
									>
										<Button
											variant="destructive"
											loading={isStopping}
											className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
										>
											<Tooltip
												content={
													<>
														<p>Stop the currently running MongoDB database</p>
													</>
												}
												className="z-[60]"
												asChild
											>
												<div className="flex items-center">
													<Ban className="size-4 mr-1" />
													Stop
												</div>
											</Tooltip>
										</Button>
									</DialogAction>
								))}
						</TooltipProvider>
						<DockerTerminalModal
							appName={data?.appName || ""}
							serverId={data?.serverId || ""}
						>
							<Button
								variant="outline"
								className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
							>
								<Tooltip
									content={
										<>
											<p>Open a terminal to the MongoDB container</p>
										</>
									}
									className="z-[60]"
									asChild
								>
									<div className="flex items-center">
										<Terminal className="size-4 mr-1" />
										Open Terminal
									</div>
								</Tooltip>
							</Button>
						</DockerTerminalModal>
					</div>
				</LayerCard>
				<DrawerLogs
					isOpen={isDrawerOpen}
					onClose={() => {
						setIsDrawerOpen(false);
						setFilteredLogs([]);
						setIsDeploying(false);
						refetch();
					}}
					filteredLogs={filteredLogs}
				/>
			</div>
		</>
	);
};
