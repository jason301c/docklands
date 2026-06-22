import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	ExternalLink,
	FileText,
	GitPullRequest,
	Hammer,
	Loader2,
	PenSquare,
	RocketIcon,
	Trash2,
} from "lucide-react";
import { api } from "@/client/api/trpc";
import { ServiceLogsModal } from "@/components/dashboard/container-runtime/logs/service-logs-modal";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { DialogAction } from "@/components/shared/dialog-action";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import { toast } from "@/components/shared/toast";
import { ShowDeploymentsModal } from "../deployments/show-deployments-modal";
import { AddPreviewDomain } from "./add-preview-domain";
import { ShowPreviewSettings } from "./show-preview-settings";

interface Props {
	applicationId: string;
}

export const ShowPreviewDeployments = ({ applicationId }: Props) => {
	const { data } = api.application.one.useQuery({ applicationId });

	const { mutateAsync: deletePreviewDeployment, isPending } =
		api.previewDeployment.delete.useMutation();

	const { mutateAsync: redeployPreviewDeployment } =
		api.previewDeployment.redeploy.useMutation();

	const {
		data: previewDeployments,
		refetch: refetchPreviewDeployments,
		isLoading: isLoadingPreviewDeployments,
	} = api.previewDeployment.all.useQuery(
		{ applicationId },
		{
			enabled: !!applicationId,
			refetchInterval: 2000,
		},
	);

	const handleDeletePreviewDeployment = async (previewDeploymentId: string) => {
		deletePreviewDeployment({
			previewDeploymentId: previewDeploymentId,
		})
			.then(() => {
				refetchPreviewDeployments();
				toast.success("Preview environment deleted");
			})
			.catch((error) => {
				toast.error(error.message);
			});
	};

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row items-center justify-between flex-wrap gap-2">
				<div className="flex flex-col gap-2">
					<h3 className="text-xl font-semibold">Preview Environments</h3>
					<p>Review pull request runtimes for this service.</p>
				</div>
				{data?.isPreviewDeploymentsActive && (
					<ShowPreviewSettings applicationId={applicationId} />
				)}
			</div>
			<div className="flex flex-col gap-4">
				{data?.isPreviewDeploymentsActive ? (
					<>
						<div className="flex flex-col gap-2 text-sm">
							<span>
								Every pull request can create an isolated runtime before changes
								reach production.
							</span>
						</div>
						{isLoadingPreviewDeployments ? (
							<div className="flex w-full flex-row items-center justify-center gap-3 min-h-[35vh]">
								<Loader2 className="size-5 text-kumo-subtle animate-spin" />
								<span className="text-base text-kumo-subtle">
									Loading preview environments...
								</span>
							</div>
						) : !previewDeployments?.length ? (
							<div className="flex w-full flex-col items-center justify-center gap-3 min-h-[35vh]">
								<RocketIcon className="size-8 text-kumo-subtle" />
								<span className="text-base text-kumo-subtle">
									No preview environments found
								</span>
							</div>
						) : (
							<div className="flex flex-col gap-4">
								{previewDeployments?.map((deployment) => {
									const deploymentUrl = `${deployment.domain?.https ? "https" : "http"}://${deployment.domain?.host}${deployment.domain?.path || "/"}`;
									const status = deployment.previewStatus;
									return (
										<div
											key={deployment.previewDeploymentId}
											className="group relative overflow-hidden border rounded-lg transition-colors"
										>
											<div
												className={`absolute left-0 top-0 w-1 h-full ${
													status === "done"
														? "bg-kumo-success"
														: status === "running"
															? "bg-kumo-warning"
															: "bg-kumo-danger"
												}`}
											/>

											<div className="p-4">
												<div className="flex items-start justify-between mb-3">
													<div className="flex items-start gap-3">
														<GitPullRequest className="size-5 text-kumo-subtle mt-1 flex-shrink-0" />
														<div>
															<div className="font-medium text-sm">
																{deployment.pullRequestTitle}
															</div>
															<div className="text-sm text-kumo-subtle mt-1">
																{deployment.branch}
															</div>
														</div>
													</div>
													<Badge variant="outline" className="gap-2">
														<StatusTooltip
															status={deployment.previewStatus}
															className="size-2"
														/>
														<DateTooltip date={deployment.createdAt} />
													</Badge>
												</div>

												<div className="pl-8 space-y-3">
													<div className="relative flex-grow">
														<Input
															aria-label="Preview deployment URL"
															value={deploymentUrl}
															readOnly
															className="pr-8 text-sm text-kumo-info hover:text-kumo-info cursor-pointer"
															onClick={() =>
																window.open(deploymentUrl, "_blank")
															}
														/>
														<ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-kumo-subtle" />
													</div>

													<div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
														<Button
															variant="outline"
															size="sm"
															className="gap-2"
															onClick={() =>
																window.open(deployment.pullRequestURL, "_blank")
															}
														>
															<GithubIcon className="size-4" />
															Pull Request
														</Button>
														<ServiceLogsModal
															appName={deployment.appName}
															runtimeWorkerId={data?.runtimeWorkerId || ""}
														>
															<Button
																variant="outline"
																size="sm"
																className="gap-2"
															>
																<FileText className="size-4" />
																Logs
															</Button>
														</ServiceLogsModal>

														<ShowDeploymentsModal
															id={deployment.previewDeploymentId}
															type="previewDeployment"
															runtimeWorkerId={data?.runtimeWorkerId || ""}
														>
															<Button
																variant="outline"
																size="sm"
																className="gap-2"
															>
																<RocketIcon className="size-4" />
																Deployments
															</Button>
														</ShowDeploymentsModal>

														<DialogAction
															title="Rebuild Preview Environment"
															description="Are you sure you want to rebuild this preview environment?"
															type="default"
															onClick={async () => {
																await redeployPreviewDeployment({
																	previewDeploymentId:
																		deployment.previewDeploymentId,
																})
																	.then(() => {
																		toast.success(
																			"Preview environment rebuild started",
																		);
																		refetchPreviewDeployments();
																	})
																	.catch(() => {
																		toast.error(
																			"Error rebuilding preview environment",
																		);
																	});
															}}
														>
															<Button
																variant="outline"
																size="sm"
																loading={status === "running"}
																className="gap-2"
															>
																<TooltipProvider>
																	<Tooltip
																		content={
																			<>
																				<p>
																					Rebuild the preview environment
																					without downloading new code
																				</p>
																			</>
																		}
																		className="z-[60]"
																		asChild
																	>
																		<div className="flex items-center gap-2">
																			<Hammer className="size-4" />
																			Rebuild
																		</div>
																	</Tooltip>
																</TooltipProvider>
															</Button>
														</DialogAction>

														<AddPreviewDomain
															previewDeploymentId={`${deployment.previewDeploymentId}`}
															domainId={deployment.domain?.domainId}
														>
															<Button
																aria-label="Edit preview domain"
																variant="ghost"
																size="sm"
																className="gap-2"
															>
																<PenSquare className="size-4" />
															</Button>
														</AddPreviewDomain>
														<DialogAction
															title="Delete Preview Environment"
															description="Are you sure you want to delete this preview?"
															onClick={() =>
																handleDeletePreviewDeployment(
																	deployment.previewDeploymentId,
																)
															}
														>
															<Button
																variant="ghost"
																size="sm"
																loading={isPending}
																className="text-kumo-danger hover:text-kumo-danger hover:bg-kumo-danger-tint"
															>
																<Trash2 className="size-4" />
															</Button>
														</DialogAction>
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</>
				) : (
					<div className="flex w-full flex-col items-center justify-center gap-3 pt-10">
						<RocketIcon className="size-8 text-kumo-subtle" />
						<span className="text-base text-kumo-subtle">
							Preview environments are disabled for this application. Enable
							them to create pull request runtimes.
						</span>
						<ShowPreviewSettings applicationId={applicationId} />
					</div>
				)}
			</div>
		</LayerCard>
	);
};
