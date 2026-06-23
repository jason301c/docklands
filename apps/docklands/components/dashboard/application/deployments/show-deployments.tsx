import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import copy from "copy-to-clipboard";
import {
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Loader2,
	RefreshCcw,
	RocketIcon,
	Settings,
	Trash2,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { DialogAction } from "@/components/shared/dialog-action";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import { toast } from "@/components/shared/toast";
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
		| "schedule"
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

export const ShowDeployments = ({
	id,
	type,
	refreshToken,
	runtimeWorkerId,
}: Props) => {
	const [activeLog, setActiveLog] = useState<
		RouterOutputs["deployment"]["allByType"][number] | null
	>(null);
	const { data: deployments, isPending: isLoadingDeployments } =
		api.deployment.allByType.useQuery(
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

	const { mutateAsync: rollback, isPending: isRollingBack } =
		api.rollback.rollback.useMutation();
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

				{isLoadingDeployments ? (
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
					<div className="flex flex-col gap-4">
						{deployments?.map((deployment, index) => {
							const titleText = deployment?.title?.trim() || "";
							const needsTruncation = titleText.length > MAX_DESCRIPTION_LENGTH;
							const isExpanded = expandedDescriptions.has(
								deployment.deploymentId,
							);
							const canDelete =
								deployment.status === "done" || deployment.status === "error";

							return (
								<div
									key={deployment.deploymentId}
									className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="flex flex-1 flex-col min-w-0">
										<span className="flex items-center gap-4 font-medium capitalize text-kumo-default">
											{index + 1}. {deployment.status}
											<StatusTooltip
												status={deployment?.status}
												className="size-2.5"
											/>
										</span>

										<div className="flex flex-col gap-1">
											<span className="break-words text-sm text-kumo-subtle whitespace-pre-wrap">
												{isExpanded || !needsTruncation
													? titleText
													: truncateDescription(titleText)}
											</span>
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
													className="flex items-center gap-1 text-xs text-kumo-subtle hover:text-kumo-default transition-colors w-fit mt-1 cursor-pointer"
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
											{/* Hash (from description) - shown in compact form */}
											{deployment.description?.trim() && (
												<span className="text-xs text-kumo-subtle font-mono">
													{deployment.description}
												</span>
											)}
										</div>
									</div>
									<div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:max-w-[300px] sm:items-end sm:justify-start">
										<div className="text-sm capitalize text-kumo-subtle flex flex-wrap items-center gap-2">
											<DateTooltip date={deployment.createdAt} />
											{deployment.startedAt && deployment.finishedAt && (
												<Badge
													variant="outline"
													className="text-[10px] gap-1 flex items-center"
												>
													<Clock className="size-3" />
													{formatDuration(
														Math.floor(
															(new Date(deployment.finishedAt).getTime() -
																new Date(deployment.startedAt).getTime()) /
																1000,
														),
													)}
												</Badge>
											)}
										</div>

										<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
											{deployment.pid && deployment.status === "running" && (
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
														className="w-full sm:w-auto"
													>
														Kill Process
													</Button>
												</DialogAction>
											)}
											<Button
												onClick={() => {
													setActiveLog(deployment);
												}}
												className="w-full sm:w-auto"
											>
												View
											</Button>

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
															toast.success(
																"Build record deleted successfully",
															);
														} catch (error) {
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

											{deployment?.rollback &&
												deployment.status === "done" &&
												type === "application" && (
													<DialogAction
														title="Rollback to this build"
														description={
															<div className="flex flex-col gap-3">
																<p>
																	Are you sure you want to rollback to this
																	build?
																</p>
																<AlertBlock type="info" className="text-sm">
																	Please wait a few seconds while the image is
																	pulled from the registry. Your application
																	should be running shortly.
																</AlertBlock>
															</div>
														}
														type="default"
														onClick={async () => {
															await rollback({
																rollbackId: deployment.rollback.rollbackId,
															})
																.then(() => {
																	toast.success(
																		"Rollback initiated successfully",
																	);
																})
																.catch((err) => {
																	logger.error(
																		"Failed to initiate rollback",
																		err,
																	);
																	toast.error("Error initiating rollback");
																});
														}}
													>
														<Button
															variant="secondary"
															size="sm"
															loading={isRollingBack}
															className="w-full sm:w-auto"
														>
															<RefreshCcw className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
															Rollback
														</Button>
													</DialogAction>
												)}
										</div>
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
