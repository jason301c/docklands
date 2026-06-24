import { Button } from "@cloudflare/kumo/components/button";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { Ban, CheckCircle2, RefreshCcw, Rocket, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { ServiceTerminalModal } from "@/components/dashboard/shared/terminal/service-terminal-modal";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { workspaceServicePath } from "@/shared/routes";

const logger = createClientLogger("compose");

interface Props {
	composeId: string;
}
export const ComposeActions = ({ composeId }: Props) => {
	const router = useRouter();
	const { permissions } = usePermissions();
	const canDeploy = permissions?.deployment.create ?? false;
	const canUpdateService = permissions?.service.create ?? false;
	const { data, refetch } = api.compose.one.useQuery(
		{
			composeId,
		},
		{ enabled: !!composeId },
	);
	const { mutateAsync: update } = api.compose.update.useMutation();
	const { mutateAsync: deploy } = api.compose.deploy.useMutation();
	const { mutateAsync: redeploy } = api.compose.redeploy.useMutation();
	const { mutateAsync: start, isPending: isStarting } =
		api.compose.start.useMutation();
	const { mutateAsync: stop, isPending: isStopping } =
		api.compose.stop.useMutation();
	return (
		<div className="flex flex-row gap-4 w-full flex-wrap ">
			<TooltipProvider delay={0}>
				{canDeploy && (
					<DialogAction
						title="Run Compose Build"
						description="Are you sure you want to queue a build for this compose service?"
						type="default"
						onClick={async () => {
							await deploy({
								composeId: composeId,
							})
								.then(() => {
									toast.success("Compose build queued");
									refetch();
									if (data?.environment.workspaceId && data.environmentId) {
										router.push(
											workspaceServicePath({
												workspaceId: data.environment.workspaceId,
												environmentId: data.environmentId,
												serviceType: "compose",
												serviceId: composeId,
												tab: "deployments",
											}),
										);
									}
								})
								.catch((err) => {
									logger.error("Failed to queue compose build", err);
									toast.error("Error queueing compose build");
								});
						}}
					>
						<Button
							variant="primary"
							loading={data?.composeStatus === "running"}
							className="flex items-center gap-1.5 group focus-visible:ring-2 focus-visible:ring-offset-2"
						>
							<Tooltip
								content={
									<>
										<p>
											Downloads the source code and performs a complete build
										</p>
									</>
								}
								asChild
							>
								<div className="flex items-center">
									<Rocket className="size-4 mr-1" />
									Run Build
								</div>
							</Tooltip>
						</Button>
					</DialogAction>
				)}
				{canDeploy && (
					<DialogAction
						title="Reload Compose"
						description="Are you sure you want to reload this compose?"
						type="default"
						onClick={async () => {
							await redeploy({
								composeId: composeId,
							})
								.then(() => {
									toast.success("Compose reloaded successfully");
									refetch();
								})
								.catch((err) => {
									logger.error("Failed to reload compose", err);
									toast.error("Error reloading compose");
								});
						}}
					>
						<Button
							variant="secondary"
							loading={data?.composeStatus === "running"}
							className="flex items-center gap-1.5 group focus-visible:ring-2 focus-visible:ring-offset-2"
						>
							<Tooltip
								content={
									<>
										<p>Reload the compose without rebuilding it</p>
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
					(data?.composeType === "docker-compose" &&
					data?.composeStatus === "idle" ? (
						<DialogAction
							title="Start Compose"
							description="Are you sure you want to start this compose?"
							type="default"
							onClick={async () => {
								await start({
									composeId: composeId,
								})
									.then(() => {
										toast.success("Compose started successfully");
										refetch();
									})
									.catch((err) => {
										logger.error("Failed to start compose", err);
										toast.error("Error starting compose");
									});
							}}
						>
							<Button
								variant="secondary"
								loading={isStarting}
								className="flex items-center gap-1.5 group focus-visible:ring-2 focus-visible:ring-offset-2"
							>
								<Tooltip
									content={
										<>
											<p>
												Start the compose (requires a previous successful build)
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
							title="Stop Compose"
							description="Are you sure you want to stop this compose?"
							onClick={async () => {
								await stop({
									composeId: composeId,
								})
									.then(() => {
										toast.success("Compose stopped successfully");
										refetch();
									})
									.catch((err) => {
										logger.error("Failed to stop compose", err);
										toast.error("Error stopping compose");
									});
							}}
						>
							<Button
								variant="destructive"
								loading={isStopping}
								className="flex items-center gap-1.5 group focus-visible:ring-2 focus-visible:ring-offset-2"
							>
								<Tooltip
									content={
										<>
											<p>Stop the currently running compose</p>
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
				appType={data?.composeType || "docker-compose"}
			>
				<Button
					variant="outline"
					className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
				>
					<Terminal className="size-4 mr-1" />
					Open Terminal
				</Button>
			</ServiceTerminalModal>
			{canUpdateService && (
				<div className="flex flex-row items-center gap-2 rounded-md px-4 py-2 border">
					<span className="text-sm font-medium">Autobuild</span>
					<Switch
						aria-label="Toggle autobuild"
						checked={data?.autoDeploy || false}
						onCheckedChange={async (enabled) => {
							await update({
								composeId,
								autoDeploy: enabled,
							})
								.then(async () => {
									toast.success("Auto Build Updated");
									await refetch();
								})
								.catch((err) => {
									logger.error("Failed to update auto build", err);
									toast.error("Error updating Auto Build");
								});
						}}
						className="flex flex-row gap-2 items-center data-[state=checked]:bg-kumo-brand"
					/>
				</div>
			)}
		</div>
	);
};
