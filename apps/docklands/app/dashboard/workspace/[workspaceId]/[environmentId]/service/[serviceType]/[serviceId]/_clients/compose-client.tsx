"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { CircuitBoard } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { UseKeyboardNav } from "@/client/hooks/use-keyboard-nav";
import { ShowImport } from "@/components/dashboard/application/advanced/import/show-import";
import { ShowVolumes } from "@/components/dashboard/application/advanced/volumes/show-volumes";
import { ShowDeployments } from "@/components/dashboard/application/deployments/show-deployments";
import { ShowDomains } from "@/components/dashboard/application/domains/show-domains";
import { ShowEnvironment } from "@/components/dashboard/application/environment/show-environment";
import { ShowPatches } from "@/components/dashboard/application/patches/show-patches";
import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { ShowVolumeBackups } from "@/components/dashboard/application/volume-backups/show-volume-backups";
import { AddCommandCompose } from "@/components/dashboard/compose/advanced/add-command";
import { IsolatedDeploymentTab } from "@/components/dashboard/compose/advanced/add-isolation";
import { ShowComposeContainers } from "@/components/dashboard/compose/containers/show-compose-containers";
import { DeleteService } from "@/components/dashboard/compose/delete-service";
import { ShowGeneralCompose } from "@/components/dashboard/compose/general/show";
import { ShowDockerLogsCompose } from "@/components/dashboard/compose/logs/show";
import { ShowDockerLogsStack } from "@/components/dashboard/compose/logs/show-stack";
import { UpdateCompose } from "@/components/dashboard/compose/update-compose";
import { ShowBackups } from "@/components/dashboard/database/backups/show-backups";
import { ComposeFreeMonitoring } from "@/components/dashboard/metrics/free/container/show-free-compose-monitoring";
import { ComposePaidMonitoring } from "@/components/dashboard/metrics/paid/container/show-paid-compose-monitoring";
import {
	RuntimePlacementStatus,
	RuntimeWorkerInactiveState,
} from "@/components/dashboard/service/runtime-placement-status";
import { AdvanceBreadcrumb } from "@/components/shared/advance-breadcrumb";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import {
	workspaceEnvironmentPath,
	workspaceServicePath,
} from "@/shared/routes";

type TabState =
	| "general"
	| "environment"
	| "advanced"
	| "backups"
	| "deployments"
	| "domains"
	| "containers"
	| "logs"
	| "monitoring"
	| "patches"
	| "schedules"
	| "volumeBackups";

const Service = (props: {
	composeId: string;
	workspaceId: string;
	environmentId: string;
	activeTab: TabState;
}) => {
	const [_toggleMonitoring, _setToggleMonitoring] = useState(false);
	const { composeId, activeTab } = props;
	const router = useRouter();
	const searchParams = useSearchParams();
	const selectedTab = searchParams?.get("tab");
	const { workspaceId, environmentId } = props;
	const [tab, setTab] = useState<TabState>(activeTab);

	useEffect(() => {
		if (selectedTab) {
			setTab(selectedTab as TabState);
		}
	}, [selectedTab]);

	const { data } = api.compose.one.useQuery({ composeId });

	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: serverIp } = api.settings.getIp.useQuery();
	const { data: environments } = api.environment.byWorkspaceId.useQuery({
		workspaceId: data?.environment?.workspaceId || "",
	});
	const environmentDropdownItems =
		environments?.map((env) => ({
			name: env.name,
			href: workspaceEnvironmentPath({
				workspaceId: workspaceId,
				environmentId: env.environmentId,
			}),
		})) || [];
	const serviceTabs = [
		{ value: "general", label: "General" },
		permissions?.envVars.read
			? { value: "environment", label: "Environment" }
			: null,
		permissions?.domain.read ? { value: "domains", label: "Domains" } : null,
		permissions?.deployment.read
			? { value: "deployments", label: "Deployments" }
			: null,
		permissions?.service.read
			? { value: "containers", label: "Containers" }
			: null,
		permissions?.service.create ? { value: "backups", label: "Backups" } : null,
		permissions?.schedule.read
			? { value: "schedules", label: "Automations" }
			: null,
		permissions?.volumeBackup.read
			? { value: "volumeBackups", label: "Volume Backups" }
			: null,
		permissions?.logs.read ? { value: "logs", label: "Logs" } : null,
		data?.sourceType !== "raw" ? { value: "patches", label: "Patches" } : null,
		permissions?.monitoring.read &&
		((data?.runtimeWorkerId && isCloud) || !data?.runtimeWorker)
			? { value: "monitoring", label: "Metrics" }
			: null,
		permissions?.service.create
			? { value: "advanced", label: "Advanced" }
			: null,
	].filter(Boolean) as { value: string; label: string }[];

	return (
		<div className="pb-10">
			<UseKeyboardNav forPage="compose" />
			<AdvanceBreadcrumb />
			<div className="w-full">
				<div className="rounded-lg border bg-kumo-canvas p-6">
					<div className="flex flex-col gap-4">
						<div className="flex flex-row justify-between items-center">
							<div className="flex flex-col">
								<h3 className="text-xl font-semibold flex items-center gap-2">
									<div className="relative flex flex-row gap-4">
										<div className="absolute -right-1 -top-2">
											<StatusTooltip status={data?.composeStatus} />
										</div>

										<CircuitBoard className="h-6 w-6 text-kumo-subtle" />
									</div>
									{data?.name}
								</h3>
								{data?.description && <p>{data?.description}</p>}

								<span className="text-sm text-kumo-subtle">
									{data?.appName}
								</span>
							</div>
							<div className="flex flex-col h-fit w-fit gap-2">
								<RuntimePlacementStatus
									fallbackIp={serverIp}
									runtimeWorker={data?.runtimeWorker}
									runtimeWorkerId={data?.runtimeWorkerId}
								/>

								<div className="flex flex-row gap-2 justify-end">
									{permissions?.service.create && (
										<UpdateCompose composeId={composeId} />
									)}

									{permissions?.service.delete && (
										<DeleteService id={composeId} type="compose" />
									)}
								</div>
							</div>
						</div>
					</div>
					<div className="space-y-2 py-8 border-t">
						{data?.runtimeWorker?.runtimeWorkerStatus === "inactive" ? (
							<RuntimeWorkerInactiveState />
						) : (
							<div className="w-full">
								<Tabs
									value={tab}
									className="w-full overflow-auto"
									onValueChange={(e) => {
										if (e === null) return;
										setTab(e as TabState);
										const newPath = workspaceServicePath({
											workspaceId: workspaceId,
											environmentId,
											serviceType: "compose",
											serviceId: composeId,
											tab: e,
										});
										router.push(newPath);
									}}
									tabs={serviceTabs}
								/>

								{tab === "general" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowGeneralCompose composeId={composeId} />
										</div>
									</div>
								)}
								{permissions?.envVars.read && tab === "environment" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowEnvironment id={composeId} type="compose" />
										</div>
									</div>
								)}
								{permissions?.service.create && tab === "backups" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowBackups id={composeId} backupType="compose" />
										</div>
									</div>
								)}

								{permissions?.schedule.read && tab === "schedules" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowSchedules id={composeId} scheduleType="compose" />
										</div>
									</div>
								)}
								{permissions?.volumeBackup.read && tab === "volumeBackups" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowVolumeBackups
												id={composeId}
												type="compose"
												runtimeWorkerId={data?.runtimeWorkerId || ""}
											/>
										</div>
									</div>
								)}
								{permissions?.service.read && tab === "containers" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowComposeContainers
												runtimeWorkerId={data?.runtimeWorkerId || undefined}
												appName={data?.appName || ""}
												appType={data?.composeType || "docker-compose"}
											/>
										</div>
									</div>
								)}

								{permissions?.monitoring.read && tab === "monitoring" && (
									<div>
										<div className="pt-2.5">
											<div className="flex flex-col border rounded-lg ">
												{data?.runtimeWorkerId && isCloud ? (
													<ComposePaidMonitoring
														runtimeWorkerId={data?.runtimeWorkerId || ""}
														baseUrl={`${data?.runtimeWorkerId ? `http://${data?.runtimeWorker?.ipAddress}:${data?.runtimeWorker?.metricsConfig?.runtimeWorker?.port}` : "http://localhost:4500"}`}
														appName={data?.appName || ""}
														token={
															data?.runtimeWorker?.metricsConfig?.runtimeWorker
																?.token || ""
														}
														appType={data?.composeType || "docker-compose"}
													/>
												) : (
													<>
														{/* {monitoring?.enabledFeatures &&
															isCloud &&
															data?.runtimeWorkerId && (
																<div className="flex flex-row border w-fit p-4 rounded-lg items-center gap-2 m-4">
																	<Label className="text-kumo-subtle">
																		Metrics source
																	</Label>
																	<Switch
																		checked={toggleMonitoring}
																		onCheckedChange={setToggleMonitoring}
																	/>
																</div>
															)}

														{toggleMonitoring ? (
															<ComposePaidMonitoring
																appName={data?.appName || ""}
																baseUrl={`http://${monitoring?.serverIp}:${monitoring?.metricsConfig?.runtimeWorker?.port}`}
																token={
																	monitoring?.metricsConfig?.runtimeWorker?.token || ""
																}
																appType={data?.composeType || "docker-compose"}
															/>
														) : ( */}
														{/* <div> */}
														<ComposeFreeMonitoring
															runtimeWorkerId={data?.runtimeWorkerId || ""}
															appName={data?.appName || ""}
															appType={data?.composeType || "docker-compose"}
														/>
														{/* </div> */}
														{/* )} */}
													</>
												)}
											</div>
										</div>
									</div>
								)}

								{permissions?.logs.read && tab === "logs" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											{data?.composeType === "docker-compose" ? (
												<ShowDockerLogsCompose
													runtimeWorkerId={data?.runtimeWorkerId || ""}
													appName={data?.appName || ""}
													appType={data?.composeType || "docker-compose"}
												/>
											) : (
												<ShowDockerLogsStack
													runtimeWorkerId={data?.runtimeWorkerId || ""}
													appName={data?.appName || ""}
												/>
											)}
										</div>
									</div>
								)}

								{permissions?.deployment.read && tab === "deployments" && (
									<div className="w-full pt-2.5">
										<div className="flex flex-col gap-4 border rounded-lg">
											<ShowDeployments
												id={composeId}
												type="compose"
												runtimeWorkerId={data?.runtimeWorkerId || ""}
												refreshToken={data?.refreshToken || ""}
											/>
										</div>
									</div>
								)}

								{permissions?.domain.read && tab === "domains" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowDomains id={composeId} type="compose" />
										</div>
									</div>
								)}

								{tab === "patches" && (
									<div className="w-full">
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowPatches id={composeId} type="compose" />
										</div>
									</div>
								)}

								{permissions?.service.create && tab === "advanced" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<AddCommandCompose composeId={composeId} />
											<ShowVolumes id={composeId} type="compose" />
											<ShowImport composeId={composeId} />
											<IsolatedDeploymentTab composeId={composeId} />
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Service;
