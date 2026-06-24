import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import copy from "copy-to-clipboard";
import { format } from "date-fns";
import {
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Eye,
	Loader2,
	MoreHorizontal,
	RefreshCcw,
	RocketIcon,
	Settings,
	Trash2,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import {
	formatLastDeployment,
	serviceStatusMeta,
} from "@/components/dashboard/workspace/canvas/service-node";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { DropdownMenu } from "@/components/shared/dropdown";
import { ErrorState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { cn } from "@/shared/utils";
import type { WorkspaceServiceStatus } from "@/shared/workspace-graph";
import { ShowRollbackSettings } from "../rollbacks/show-rollback-settings";
import { CancelQueues } from "./cancel-queues";
import { ClearDeployments } from "./clear-deployments";
import { KillBuild } from "./kill-build";
import { RefreshToken } from "./refresh-token";
import { ShowDeployment } from "./show-deployment";

const logger = createClientLogger("deployments");

interface Props {
	id: string;
	type:
		| "application"
		| "compose"
		| "runtimeWorker"
		| "backup"
		| "previewDeployment"
		| "volumeBackup";
	refreshToken?: string;
	runtimeWorkerId?: string;
}

export const formatDuration = (seconds: number) => {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
};

type Deployment = RouterOutputs["deployment"]["allByType"][number];

/**
 * The canvas-status helper is typed for the workspace service union
 * (`idle | running | done | error`). Deployments add a terminal `cancelled`
 * status, which has no dedicated swatch and intentionally falls through to the
 * muted "default" branch — so reuse the same color/label mapping by widening the
 * cast rather than maintaining a parallel table here.
 */
const deploymentStatusMeta = (status: Deployment["status"]) =>
	serviceStatusMeta(status as WorkspaceServiceStatus | null | undefined);

export const ShowDeployments = ({
	id,
	type,
	refreshToken,
	runtimeWorkerId,
}: Props) => {
	const [activeLog, setActiveLog] = useState<Deployment | null>(null);
	const deploymentsQuery = api.deployment.allByType.useQuery(
		{
			id,
			type,
		},
		{
			enabled: !!id,
			// Only poll while a build is in flight; stop once all are terminal.
			refetchInterval: (query) =>
				query.state.data?.some((d) => d.status === "running") ? 1000 : false,
		},
	);
	const {
		data: deployments,
		isPending: isLoadingDeployments,
		isError: isDeploymentsError,
		error: deploymentsError,
		refetch: refetchDeployments,
	} = deploymentsQuery;

	const utils = api.useUtils();
	const { mutateAsync: rollback, isPending: isRollingBack } =
		api.rollback.rollback.useMutation();
	const { mutateAsync: deleteRollback, isPending: isDeletingRollback } =
		api.rollback.delete.useMutation();
	const { mutateAsync: killProcess, isPending: isKillingProcess } =
		api.deployment.killProcess.useMutation();
	const { mutateAsync: removeDeployment, isPending: isRemovingDeployment } =
		api.deployment.removeDeployment.useMutation();

	const [url, setUrl] = React.useState("");
	const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
		new Set(),
	);

	const webhookUrl = useMemo(
		() =>
			`${url}/api/deploy${type === "compose" ? "/compose" : ""}/${refreshToken}`,
		[url, refreshToken, type],
	);

	const MAX_DESCRIPTION_LENGTH = 200;

	const truncateDescription = (description: string): string => {
		if (description.length <= MAX_DESCRIPTION_LENGTH) {
			return description;
		}
		const truncated = description.slice(0, MAX_DESCRIPTION_LENGTH);
		const lastSpace = truncated.lastIndexOf(" ");
		if (lastSpace > MAX_DESCRIPTION_LENGTH - 20 && lastSpace > 0) {
			return `${truncated.slice(0, lastSpace)}...`;
		}
		return `${truncated}...`;
	};

	useEffect(() => {
		setUrl(document.location.origin);
	}, []);

	return (
		<LayerCard className="bg-kumo-canvas border-none">
			<div className="flex flex-row items-center justify-between flex-wrap gap-2">
				<div className="flex flex-col gap-2">
					<h3 className="text-xl font-semibold">Deployments</h3>
					<p>See the last 10 deployments for this {type}</p>
				</div>
				<div className="flex flex-row items-center flex-wrap gap-2">
					{(type === "application" || type === "compose") && (
						<ClearDeployments id={id} type={type} />
					)}
					{(type === "application" || type === "compose") && (
						<KillBuild id={id} type={type} />
					)}
					{(type === "application" || type === "compose") && (
						<CancelQueues id={id} type={type} />
					)}
					{type === "application" && (
						<ShowRollbackSettings applicationId={id}>
							<Button variant="outline">
								Configure Rollbacks <Settings className="size-4" />
							</Button>
						</ShowRollbackSettings>
					)}
				</div>
			</div>
			<div className="flex flex-col gap-4">
				{refreshToken && (
					<div className="flex flex-col gap-2 text-sm">
						<span>
							If you want to trigger a new build, use this URL in your Git
							provider or runtime webhook configuration.
						</span>
						<div className="flex flex-row items-center gap-2 flex-wrap">
							<span>Webhook URL: </span>
							<div className="flex flex-row items-center gap-2">
								<button
									type="button"
									aria-label="Copy webhook URL to clipboard"
									className="p-2 rounded-md ml-1 mr-1 border hover:border-kumo-brand hover:text-kumo-inverse hover:bg-kumo-brand hover:cursor-pointer whitespace-normal break-all inline-flex items-center"
									onClick={() => {
										copy(webhookUrl);
										toast.success("Copied to clipboard.");
									}}
								>
									{webhookUrl}
									<Copy className="h-4 w-4 ml-2" />
								</button>
								{(type === "application" || type === "compose") && (
									<RefreshToken id={id} type={type} />
								)}
							</div>
						</div>
					</div>
				)}

				{isDeploymentsError ? (
					<ErrorState
						error={deploymentsError}
						title="Failed to load deployments"
						onRetry={() => refetchDeployments()}
					/>
				) : isLoadingDeployments ? (
					<div className="flex w-full flex-row items-center justify-center gap-3 pt-10 min-h-[25vh]">
						<Loader2 className="size-6 text-kumo-subtle animate-spin" />
						<span className="text-base text-kumo-subtle">
							Loading deployments...
						</span>
					</div>
				) : deployments?.length === 0 ? (
					<div className="flex w-full flex-col items-center justify-center gap-3 pt-10 min-h-[25vh]">
						<RocketIcon className="size-8 text-kumo-subtle" />
						<span className="text-base text-kumo-subtle">
							No deployments found
						</span>
					</div>
				) : (
					<div className="flex flex-col gap-2.5">
						{deployments?.map((deployment, index) => {
							const titleText = deployment?.title?.trim() || "";
							const needsTruncation = titleText.length > MAX_DESCRIPTION_LENGTH;
							const isExpanded = expandedDescriptions.has(
								deployment.deploymentId,
							);
							const canDelete =
								deployment.status === "done" || deployment.status === "error";
							const canRollback =
								Boolean(deployment?.rollback) &&
								deployment.status === "done" &&
								type === "application";
							const canKill =
								Boolean(deployment.pid) && deployment.status === "running";
							const isLive = deployment.status === "running";
							const statusMeta = deploymentStatusMeta(deployment.status);
							const durationSeconds =
								deployment.startedAt && deployment.finishedAt
									? Math.floor(
											(new Date(deployment.finishedAt).getTime() -
												new Date(deployment.startedAt).getTime()) /
												1000,
										)
									: null;

							return (
								<div
									key={deployment.deploymentId}
									className={cn(
										"group/row relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-kumo-canvas/60 p-4 transition hover:bg-kumo-canvas sm:flex-row sm:items-center sm:justify-between sm:gap-4",
										isLive && "border-kumo-brand/40 bg-kumo-brand/5",
									)}
								>
									{/* Live accent rail for the in-flight deployment. */}
									{isLive && (
										<span
											aria-hidden="true"
											className="absolute inset-y-0 left-0 w-0.5 animate-pulse bg-kumo-brand"
										/>
									)}

									<div className="flex min-w-0 flex-1 items-start gap-3">
										<div className="flex flex-col items-center pt-1">
											<span
												className={cn(
													"size-2.5 shrink-0 rounded-full",
													statusMeta.dotClass,
													statusMeta.pulse && "animate-pulse",
												)}
											/>
										</div>
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-xs font-medium tabular-nums text-kumo-subtle">
													#{index + 1}
												</span>
												<span
													className={cn(
														"text-sm font-medium",
														isLive ? "text-kumo-brand" : "text-kumo-default",
													)}
												>
													{statusMeta.label}
												</span>
												{isLive && (
													<Badge
														variant="outline"
														className="border-kumo-brand/40 text-[10px] text-kumo-brand"
													>
														Live
													</Badge>
												)}
											</div>

											{titleText && (
												<span className="break-words text-sm text-kumo-default whitespace-pre-wrap">
													{isExpanded || !needsTruncation
														? titleText
														: truncateDescription(titleText)}
												</span>
											)}
											{needsTruncation && (
												<button
													type="button"
													onClick={() => {
														const next = new Set(expandedDescriptions);
														if (next.has(deployment.deploymentId)) {
															next.delete(deployment.deploymentId);
														} else {
															next.add(deployment.deploymentId);
														}
														setExpandedDescriptions(next);
													}}
													className="flex w-fit items-center gap-1 text-xs text-kumo-subtle transition-colors hover:text-kumo-default cursor-pointer"
													aria-label={
														isExpanded
															? "Collapse commit message"
															: "Expand commit message"
													}
												>
													{isExpanded ? (
														<>
															<ChevronUp className="size-3" />
															Show less
														</>
													) : (
														<>
															<ChevronDown className="size-3" />
															Show more
														</>
													)}
												</button>
											)}

											<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-kumo-subtle">
												<TooltipProvider delay={0}>
													<Tooltip
														content={format(
															new Date(deployment.createdAt),
															"PPpp",
														)}
													>
														<span className="cursor-default">
															{formatLastDeployment(deployment.createdAt)}
														</span>
													</Tooltip>
												</TooltipProvider>
												{durationSeconds !== null && (
													<span className="flex items-center gap-1">
														<Clock className="size-3" />
														{formatDuration(durationSeconds)}
													</span>
												)}
												{/* Hash (from description) - shown in compact mono form */}
												{deployment.description?.trim() && (
													<span className="font-mono">
														{deployment.description}
													</span>
												)}
											</div>
										</div>
									</div>

									{/* Row actions: quiet by default, revealed on hover/focus on
									    desktop and always visible on touch. Destructive actions keep
									    their confirmation dialogs; the overflow menu only holds safe,
									    non-confirm extras (no dialog nested inside a menu item). */}
									<div className="flex w-full shrink-0 flex-wrap items-center gap-2 transition-opacity sm:w-auto sm:justify-end sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
										{canKill && (
											<DialogAction
												title="Kill Process"
												description="Are you sure you want to kill the process?"
												type="default"
												onClick={async () => {
													await killProcess({
														deploymentId: deployment.deploymentId,
													})
														.then(() => {
															toast.success("Process killed successfully");
														})
														.catch((err) => {
															logger.error("Failed to kill process", err);
															toast.error("Error killing process");
														});
												}}
											>
												<Button
													variant="destructive"
													size="sm"
													loading={isKillingProcess}
												>
													Kill Process
												</Button>
											</DialogAction>
										)}

										<Button
											variant="outline"
											size="sm"
											onClick={() => {
												setActiveLog(deployment);
											}}
										>
											<Eye className="size-4" />
											View
										</Button>

										{canRollback && (
											<DialogAction
												title="Rollback to this build"
												description={
													<div className="flex flex-col gap-3">
														<p>
															Are you sure you want to rollback to this build?
														</p>
														<AlertBlock type="info" className="text-sm">
															Please wait a few seconds while the image is
															pulled from the registry. Your application should
															be running shortly.
														</AlertBlock>
													</div>
												}
												type="default"
												onClick={async () => {
													await rollback({
														rollbackId: deployment.rollback.rollbackId,
													})
														.then(() => {
															toast.success("Rollback initiated successfully");
														})
														.catch((err) => {
															logger.error("Failed to initiate rollback", err);
															toast.error("Error initiating rollback");
														});
												}}
											>
												<Button
													variant="secondary"
													size="sm"
													loading={isRollingBack}
												>
													<RefreshCcw className="size-4 text-kumo-brand" />
													Rollback
												</Button>
											</DialogAction>
										)}

										{canDelete && (
											<DialogAction
												title="Delete Build Record"
												description="Are you sure you want to delete this build record? This action cannot be undone."
												type="default"
												onClick={async () => {
													try {
														await removeDeployment({
															deploymentId: deployment.deploymentId,
														});
														toast.success("Build record deleted successfully");
													} catch (_error) {
														toast.error("Error deleting build record");
													}
												}}
											>
												<Button
													variant="destructive"
													size="sm"
													loading={isRemovingDeployment}
												>
													Delete
													<Trash2 className="size-4" />
												</Button>
											</DialogAction>
										)}

										{canRollback && (
											<DialogAction
												title="Delete rollback"
												description="Are you sure you want to delete this rollback? This removes the stored snapshot and its container image and cannot be undone."
												type="default"
												onClick={async () => {
													await deleteRollback({
														rollbackId: deployment.rollback.rollbackId,
													})
														.then(async () => {
															toast.success("Rollback deleted");
															await utils.deployment.allByType.invalidate({
																id,
																type,
															});
														})
														.catch((err) => {
															logger.error("Failed to delete rollback", err);
															toast.error("Error deleting rollback");
														});
												}}
											>
												<Button
													variant="destructive"
													size="sm"
													loading={isDeletingRollback}
												>
													Delete rollback
													<Trash2 className="size-4" />
												</Button>
											</DialogAction>
										)}

										<DropdownMenu>
											<DropdownMenu.Trigger
												render={
													<Button
														aria-label="More deployment actions"
														variant="ghost"
														size="sm"
														shape="square"
													>
														<MoreHorizontal className="size-4" />
													</Button>
												}
											/>
											<DropdownMenu.Content align="end">
												<DropdownMenu.Group>
													<DropdownMenu.Label>Deployment</DropdownMenu.Label>
												</DropdownMenu.Group>
												<DropdownMenu.Item
													icon={Eye}
													onClick={() => {
														setActiveLog(deployment);
													}}
												>
													View logs
												</DropdownMenu.Item>
												<DropdownMenu.Item
													icon={Copy}
													onClick={() => {
														copy(deployment.deploymentId);
														toast.success("Copied to clipboard.");
													}}
												>
													Copy deployment ID
												</DropdownMenu.Item>
											</DropdownMenu.Content>
										</DropdownMenu>
									</div>
								</div>
							);
						})}
					</div>
				)}
				<ShowDeployment
					runtimeWorkerId={activeLog?.buildRuntimeWorkerId || runtimeWorkerId}
					open={Boolean(activeLog && activeLog.logPath !== null)}
					onClose={() => setActiveLog(null)}
					logPath={activeLog?.logPath || ""}
					errorMessage={activeLog?.errorMessage || ""}
				/>
			</div>
		</LayerCard>
	);
};
