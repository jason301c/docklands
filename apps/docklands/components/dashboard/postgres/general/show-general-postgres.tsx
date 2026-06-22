import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { Ban, CheckCircle2, RefreshCcw, Rocket, Terminal } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { ServiceTerminalModal } from "@/components/dashboard/container-runtime/terminal/service-terminal-modal";
import { DialogAction } from "@/components/shared/dialog-action";
import { DrawerLogs } from "@/components/shared/drawer-logs";
import { toast } from "@/components/shared/toast";
import { type LogLine, parseLogs } from "../../container-runtime/logs/utils";

interface Props {
	postgresId: string;
}

export const ShowGeneralPostgres = ({ postgresId }: Props) => {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canDeploy = permissions?.deployment.create ?? false;
	const { data, refetch } = api.postgres.one.useQuery(
		{
			postgresId: postgresId,
		},
		{ enabled: !!postgresId },
	);

	const { mutateAsync: reload, isPending: isReloading } =
		api.postgres.reload.useMutation();

	const { mutateAsync: stop, isPending: isStopping } =
		api.postgres.stop.useMutation();

	const { mutateAsync: start, isPending: isStarting } =
		api.postgres.start.useMutation();

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);
	api.postgres.deployWithLogs.useSubscription(
		{
			postgresId: postgresId,
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
				<LayerCard className="bg-kumo-canvas">
					<div>
						<h3 className="text-xl font-semibold">Runtime Setup</h3>
					</div>
					<div className="flex flex-row gap-4 flex-wrap">
						<TooltipProvider>
							{canDeploy && (
								<DialogAction
									title="Provision PostgreSQL"
									description="Are you sure you want to provision this PostgreSQL database?"
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
													<p>Downloads and sets up the PostgreSQL database</p>
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
									title="Reload PostgreSQL"
									description="Are you sure you want to reload this PostgreSQL database?"
									type="default"
									onClick={async () => {
										await reload({
											postgresId: postgresId,
											appName: data?.appName || "",
										})
											.then(() => {
												toast.success("PostgreSQL reloaded successfully");
												refetch();
											})
											.catch(() => {
												toast.error("Error reloading PostgreSQL");
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
														Restart the PostgreSQL service without rebuilding
													</p>
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
										title="Start PostgreSQL"
										description="Are you sure you want to start this PostgreSQL database?"
										type="default"
										onClick={async () => {
											await start({
												postgresId: postgresId,
											})
												.then(() => {
													toast.success("PostgreSQL started successfully");
													refetch();
												})
												.catch(() => {
													toast.error("Error starting PostgreSQL");
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
															Start the PostgreSQL database (requires a previous
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
										title="Stop PostgreSQL"
										description="Are you sure you want to stop this PostgreSQL database?"
										onClick={async () => {
											await stop({
												postgresId: postgresId,
											})
												.then(() => {
													toast.success("PostgreSQL stopped successfully");
													refetch();
												})
												.catch(() => {
													toast.error("Error stopping PostgreSQL");
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
															Stop the currently running PostgreSQL database
														</p>
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
											<p>Open a terminal to the PostgreSQL container</p>
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
