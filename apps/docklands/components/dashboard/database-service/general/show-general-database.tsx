import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { Ban, CheckCircle2, RefreshCcw, Rocket, Terminal } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";

const logger = createClientLogger("database-service");

import { ServiceTerminalModal } from "@/components/dashboard/container-runtime/terminal/service-terminal-modal";
import { DialogAction } from "@/components/shared/dialog-action";
import { DrawerLogs } from "@/components/shared/drawer-logs";
import { type LogLine, parseLogs } from "@/components/shared/logs/utils";
import { toast } from "@/components/shared/toast";
import { ENGINE_LABELS } from "./engine-labels";

interface Props {
	databaseId: string;
}

export const ShowGeneralDatabase = ({ databaseId }: Props) => {
	const { permissions } = usePermissions();
	const canDeploy = permissions?.deployment.create ?? false;
	const { data, refetch } = api.database.one.useQuery(
		{
			databaseId: databaseId,
		},
		{ enabled: !!databaseId },
	);

	const engineLabel = data?.engine ? ENGINE_LABELS[data.engine] : "database";

	const { mutateAsync: reload, isPending: isReloading } =
		api.database.reload.useMutation();

	const { mutateAsync: stop, isPending: isStopping } =
		api.database.stop.useMutation();

	const { mutateAsync: start, isPending: isStarting } =
		api.database.start.useMutation();

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);
	api.database.deployWithLogs.useSubscription(
		{
			databaseId: databaseId,
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
				logger.error("deployment logs error:", error);
				toast.warning("Log stream interrupted");
				setIsDeploying(false);
			},
		},
	);

	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<LayerCard className="bg-kumo-canvas">
					<div>
						<h3 className="text-xl font-semibold">Runtime Setup</h3>
					</div>
					<div className="flex flex-row gap-4 flex-wrap">
						<TooltipProvider>
							{canDeploy && (
								<DialogAction
									title={`Provision ${engineLabel}`}
									description={`Are you sure you want to provision this ${engineLabel} database?`}
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
													<p>
														Downloads and sets up the {engineLabel} database
													</p>
												</>
											}
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
									title={`Reload ${engineLabel}`}
									description={`Are you sure you want to reload this ${engineLabel} database?`}
									type="default"
									onClick={async () => {
										await reload({
											databaseId: databaseId,
										})
											.then(() => {
												toast.success(`${engineLabel} reloaded successfully`);
												refetch();
											})
											.catch((err) => {
												logger.error("Error reloading database:", err);
												toast.error(`Error reloading ${engineLabel}`);
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
													<p>
														Restart the {engineLabel} service without rebuilding
													</p>
												</>
											}
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
										title={`Start ${engineLabel}`}
										description={`Are you sure you want to start this ${engineLabel} database?`}
										type="default"
										onClick={async () => {
											await start({
												databaseId: databaseId,
											})
												.then(() => {
													toast.success(`${engineLabel} started successfully`);
													refetch();
												})
												.catch((err) => {
													logger.error("Error starting database:", err);
													toast.error(`Error starting ${engineLabel}`);
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
															Start the {engineLabel} database (requires a
															previous successful setup)
														</p>
													</>
												}
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
										title={`Stop ${engineLabel}`}
										description={`Are you sure you want to stop this ${engineLabel} database?`}
										onClick={async () => {
											await stop({
												databaseId: databaseId,
											})
												.then(() => {
													toast.success(`${engineLabel} stopped successfully`);
													refetch();
												})
												.catch((err) => {
													logger.error("Error stopping database:", err);
													toast.error(`Error stopping ${engineLabel}`);
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
														<p>
															Stop the currently running {engineLabel} database
														</p>
													</>
												}
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
						<ServiceTerminalModal
							appName={data?.appName || ""}
							runtimeWorkerId={data?.runtimeWorkerId || ""}
						>
							<Button
								variant="outline"
								className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
							>
								<Tooltip
									content={
										<>
											<p>Open a terminal to the {engineLabel} container</p>
										</>
									}
									asChild
								>
									<div className="flex items-center">
										<Terminal className="size-4 mr-1" />
										Open Terminal
									</div>
								</Tooltip>
							</Button>
						</ServiceTerminalModal>
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
