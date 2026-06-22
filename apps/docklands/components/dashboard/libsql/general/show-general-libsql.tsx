import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { Ban, CheckCircle2, RefreshCcw, Rocket, Terminal } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { DialogAction } from "@/components/shared/dialog-action";
import { DrawerLogs } from "@/components/shared/drawer-logs";
import { toast } from "@/components/shared/toast";
import { type LogLine, parseLogs } from "../../docker/logs/utils";
import { DockerTerminalModal } from "../../settings/web-server/docker-terminal-modal";

interface Props {
	libsqlId: string;
}

export const ShowGeneralLibsql = ({ libsqlId }: Props) => {
	const { data, refetch } = api.libsql.one.useQuery(
		{
			libsqlId,
		},
		{ enabled: !!libsqlId },
	);

	const { mutateAsync: reload, isPending: isReloading } =
		api.libsql.reload.useMutation();

	const { mutateAsync: start, isPending: isStarting } =
		api.libsql.start.useMutation();

	const { mutateAsync: stop, isPending: isStopping } =
		api.libsql.stop.useMutation();

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);
	api.libsql.deployWithLogs.useSubscription(
		{
			libsqlId: libsqlId,
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
							<DialogAction
								title="Provision libSQL"
								description="Are you sure you want to provision this libSQL database?"
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
												<p>Downloads and sets up the libSQL database</p>
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
						</TooltipProvider>
						<TooltipProvider delay={0}>
							<DialogAction
								title="Reload libSQL"
								description="Are you sure you want to reload this libSQL database?"
								type="default"
								onClick={async () => {
									await reload({
										libsqlId: libsqlId,
										appName: data?.appName || "",
									})
										.then(() => {
											toast.success("libSQL reloaded successfully");
											refetch();
										})
										.catch(() => {
											toast.error("Error reloading libSQL");
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
												<p>Restart the libSQL service without rebuilding</p>
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
						</TooltipProvider>
						{data?.applicationStatus === "idle" ? (
							<TooltipProvider delay={0}>
								<DialogAction
									title="Start libSQL"
									description="Are you sure you want to start this libSQL database?"
									type="default"
									onClick={async () => {
										await start({
											libsqlId: libsqlId,
										})
											.then(() => {
												toast.success("libSQL started successfully");
												refetch();
											})
											.catch(() => {
												toast.error("Error starting libSQL");
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
														Start the libSQL database (requires a previous
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
							</TooltipProvider>
						) : (
							<TooltipProvider delay={0}>
								<DialogAction
									title="Stop libSQL"
									description="Are you sure you want to stop this libSQL database?"
									onClick={async () => {
										await stop({
											libsqlId: libsqlId,
										})
											.then(() => {
												toast.success("libSQL stopped successfully");
												refetch();
											})
											.catch(() => {
												toast.error("Error stopping libSQL");
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
													<p>Stop the currently running libSQL database</p>
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
							</TooltipProvider>
						)}
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
											<p>Open a terminal to the libSQL container</p>
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
