import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	Ban,
	CheckCircle2,
	Hammer,
	RefreshCcw,
	Rocket,
	Terminal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { ShowBuildChooseForm } from "@/components/dashboard/application/build/show";
import { ShowProviderForm } from "@/components/dashboard/application/general/generic/show";
import { ServiceTerminalModal } from "@/components/dashboard/container-runtime/terminal/service-terminal-modal";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { workspaceServicePath } from "@/shared/routes";

const logger = createClientLogger("application");

interface Props {
	applicationId: string;
}

export const ShowGeneralApplication = ({ applicationId }: Props) => {
	const router = useRouter();
	const { permissions } = usePermissions();
	const canDeploy = permissions?.deployment.create ?? false;
	const canUpdateService = permissions?.service.create ?? false;
	const { data, refetch } = api.application.one.useQuery(
		{
			applicationId,
		},
		{ enabled: !!applicationId },
	);
	const { mutateAsync: update } = api.application.update.useMutation();
	const { mutateAsync: start, isPending: isStarting } =
		api.application.start.useMutation();
	const { mutateAsync: stop, isPending: isStopping } =
		api.application.stop.useMutation();

	const { mutateAsync: deploy } = api.application.deploy.useMutation();

	const { mutateAsync: reload, isPending: isReloading } =
		api.application.reload.useMutation();

	const { mutateAsync: redeploy } = api.application.redeploy.useMutation();

	return (
		<>
			<LayerCard className="bg-kumo-canvas">
				<div>
					<h3 className="text-xl font-semibold">Build Settings</h3>
				</div>
				<div className="grid grid-cols-2 lg:flex lg:flex-row lg:flex-wrap gap-4">
					<TooltipProvider delay={0}>
						{canDeploy && (
							<DialogAction
								title="Run Application Build"
								description="Are you sure you want to queue a build for this application?"
								type="default"
								onClick={async () => {
									await deploy({
										applicationId: applicationId,
									})
										.then(() => {
											toast.success("Application build queued");
											refetch();
											if (data?.environment.workspaceId && data.environmentId) {
												router.push(
													workspaceServicePath({
														workspaceId: data.environment.workspaceId,
														environmentId: data.environmentId,
														serviceType: "application",
														serviceId: applicationId,
														tab: "deployments",
													}),
												);
											}
										})
										.catch((err) => {
											logger.error("Failed to queue application build", err);
											toast.error("Error queueing application build");
										});
								}}
							>
								<Button
									variant="primary"
									loading={data?.applicationStatus === "running"}
									className="flex items-center gap-1.5 group focus-visible:ring-2 focus-visible:ring-offset-2"
								>
									<Tooltip
										content={
											<>
												<p>
													Downloads the source code and performs a complete
													build
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
								title="Reload Application"
								description="Are you sure you want to reload this application?"
								type="default"
								onClick={async () => {
									await reload({
										applicationId: applicationId,
										appName: data?.appName || "",
									})
										.then(() => {
											toast.success("Application reloaded successfully");
											refetch();
										})
										.catch((err) => {
											logger.error("Failed to reload application", err);
											toast.error("Error reloading application");
										});
								}}
							>
								<Button
									variant="secondary"
									loading={isReloading}
									className="flex items-center gap-1.5 group focus-visible:ring-2 focus-visible:ring-offset-2"
								>
									<Tooltip
										content={
											<>
												<p>Reload the application without rebuilding it</p>
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
						{canDeploy && (
							<DialogAction
								title="Rebuild Application"
								description="Are you sure you want to rebuild this application?"
								type="default"
								onClick={async () => {
									await redeploy({
										applicationId: applicationId,
									})
										.then(() => {
											toast.success("Application rebuilt successfully");
											refetch();
										})
										.catch((err) => {
											logger.error("Failed to rebuild application", err);
											toast.error("Error rebuilding application");
										});
								}}
							>
								<Button
									variant="secondary"
									loading={data?.applicationStatus === "running"}
									className="flex items-center gap-1.5 group focus-visible:ring-2 focus-visible:ring-offset-2"
								>
									<Tooltip
										content={
											<>
												<p>
													Only rebuilds the application without downloading new
													code
												</p>
											</>
										}
										asChild
									>
										<div className="flex items-center">
											<Hammer className="size-4 mr-1" />
											Rebuild
										</div>
									</Tooltip>
								</Button>
							</DialogAction>
						)}

						{canDeploy && data?.applicationStatus === "idle" ? (
							<DialogAction
								title="Start Application"
								description="Are you sure you want to start this application?"
								type="default"
								onClick={async () => {
									await start({
										applicationId: applicationId,
									})
										.then(() => {
											toast.success("Application started successfully");
											refetch();
										})
										.catch((err) => {
											logger.error("Failed to start application", err);
											toast.error("Error starting application");
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
													Start the application (requires a previous successful
													build)
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
						) : canDeploy ? (
							<DialogAction
								title="Stop Application"
								description="Are you sure you want to stop this application?"
								onClick={async () => {
									await stop({
										applicationId: applicationId,
									})
										.then(() => {
											toast.success("Application stopped successfully");
											refetch();
										})
										.catch((err) => {
											logger.error("Failed to stop application", err);
											toast.error("Error stopping application");
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
												<p>Stop the currently running application</p>
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
						) : null}
					</TooltipProvider>
					<ServiceTerminalModal
						appName={data?.appName || ""}
						runtimeWorkerId={data?.runtimeWorkerId || ""}
					>
						<Button
							variant="outline"
							className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 col-span-2"
						>
							<Terminal className="size-4 mr-1" />
							Open Terminal
						</Button>
					</ServiceTerminalModal>
					{canUpdateService && (
						<div className="flex flex-row items-center gap-2 justify-between rounded-md px-4 py-2 border col-span-2 md:col-span-1">
							<span className="text-sm font-medium">Autobuild</span>
							<Switch
								aria-label="Toggle autobuild"
								checked={data?.autoDeploy || false}
								onCheckedChange={async (enabled) => {
									await update({
										applicationId,
										autoDeploy: enabled,
									})
										.then(async () => {
											toast.success("Auto Build Updated");
											await refetch();
										})
										.catch((err) => {
											logger.error("Failed to update Auto Build", err);
											toast.error("Error updating Auto Build");
										});
								}}
								className="flex flex-row gap-2 items-center data-[state=checked]:bg-kumo-brand"
							/>
						</div>
					)}

					{canUpdateService && (
						<div className="flex flex-row items-center gap-2 justify-between rounded-md px-4 py-2 border col-span-2 md:col-span-1">
							<span className="text-sm font-medium">Clean Cache</span>
							<Switch
								aria-label="Toggle clean cache"
								checked={data?.cleanCache || false}
								onCheckedChange={async (enabled) => {
									await update({
										applicationId,
										cleanCache: enabled,
									})
										.then(async () => {
											toast.success("Clean Cache Updated");
											await refetch();
										})
										.catch((err) => {
											logger.error("Failed to update Clean Cache", err);
											toast.error("Error updating Clean Cache");
										});
								}}
								className="flex flex-row gap-2 items-center data-[state=checked]:bg-kumo-brand"
							/>
						</div>
					)}
				</div>
			</LayerCard>
			<ShowProviderForm applicationId={applicationId} />
			<ShowBuildChooseForm applicationId={applicationId} />
		</>
	);
};
