"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { UseKeyboardNav } from "@/client/hooks/use-keyboard-nav";
import { ShowClusterSettings } from "@/components/dashboard/application/advanced/cluster/show-cluster-settings";
import { AddCommand } from "@/components/dashboard/application/advanced/general/add-command";
import { ShowIngressConfig } from "@/components/dashboard/application/advanced/ingress/show-ingress-config";
import { ShowPorts } from "@/components/dashboard/application/advanced/ports/show-port";
import { ShowRedirects } from "@/components/dashboard/application/advanced/redirects/show-redirects";
import { ShowSecurity } from "@/components/dashboard/application/advanced/security/show-security";
import { ShowBuildServer } from "@/components/dashboard/application/advanced/show-build-server";
import { ShowResources } from "@/components/dashboard/application/advanced/show-resources";
import { ShowVolumes } from "@/components/dashboard/application/advanced/volumes/show-volumes";
import { ShowDeployments } from "@/components/dashboard/application/deployments/show-deployments";
import { ShowDomains } from "@/components/dashboard/application/domains/show-domains";
import { ShowEnvironment } from "@/components/dashboard/application/environment/show";
import { ShowGeneralApplication } from "@/components/dashboard/application/general/show";
import { ShowIconSettings } from "@/components/dashboard/application/icon/show-icon-settings";
import { ShowDockerLogs } from "@/components/dashboard/application/logs/show";
import { ShowPatches } from "@/components/dashboard/application/patches/show-patches";
import { ShowPreviewDeployments } from "@/components/dashboard/application/preview-deployments/show-preview-deployments";
import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { UpdateApplication } from "@/components/dashboard/application/update-application";
import { ShowVolumeBackups } from "@/components/dashboard/application/volume-backups/show-volume-backups";
import { DeleteService } from "@/components/dashboard/compose/delete-service";
import { ContainerFreeMonitoring } from "@/components/dashboard/metrics/free/container/show-free-container-monitoring";
import { ContainerPaidMonitoring } from "@/components/dashboard/metrics/paid/container/show-paid-container-monitoring";
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
	| "deployments"
	| "domains"
	| "logs"
	| "monitoring"
	| "patches"
	| "preview-deployments"
	| "schedules"
	| "volume-backups"
	| "icon";

const Service = (props: {
	applicationId: string;
	projectId: string;
	environmentId: string;
	activeTab: TabState;
}) => {
	const [_toggleMonitoring, _setToggleMonitoring] = useState(false);
	const { applicationId, activeTab } = props;
	const router = useRouter();
	const searchParams = useSearchParams();
	const selectedTab = searchParams?.get("tab");
	const { projectId, environmentId } = props;
	const [tab, setTab] = useState<TabState>(activeTab);

	useEffect(() => {
		if (selectedTab) {
			setTab(selectedTab as TabState);
		}
	}, [selectedTab]);

	const { data } = api.application.one.useQuery(
		{ applicationId },
		{
			refetchInterval: 5000,
		},
	);

	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: serverIp } = api.settings.getIp.useQuery();
	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const { data: environments } = api.environment.byProjectId.useQuery({
		projectId: data?.environment?.project?.projectId || "",
	});
	const environmentDropdownItems =
		environments?.map((env) => ({
			name: env.name,
			href: workspaceEnvironmentPath({
				workspaceId: projectId,
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
		permissions?.deployment.read
			? { value: "preview-deployments", label: "Previews" }
			: null,
		permissions?.schedule.read
			? { value: "schedules", label: "Automations" }
			: null,
		permissions?.volumeBackup.read
			? { value: "volume-backups", label: "Volume Backups" }
			: null,
		permissions?.logs.read ? { value: "logs", label: "Logs" } : null,
		data?.sourceType !== "docker"
			? { value: "patches", label: "Patches" }
			: null,
		permissions?.monitoring.read &&
		((data?.serverId && isCloud) || !data?.server)
			? { value: "monitoring", label: "Metrics" }
			: null,
		permissions?.service.create
			? { value: "advanced", label: "Advanced" }
			: null,
	].filter(Boolean) as { value: string; label: string }[];

	return (
		<div className="pb-10">
			<UseKeyboardNav forPage="application" />
			<AdvanceBreadcrumb />
			<div className="w-full">
				<div className="rounded-lg border bg-background p-6">
					<div className="flex flex-row justify-between items-center">
						<div className="flex flex-col">
							<h3 className="text-xl flex flex-row gap-2 items-center">
								<div className="relative flex flex-row gap-4 items-center">
									<ShowIconSettings
										applicationId={applicationId}
										icon={data?.icon}
									/>
									<div className="absolute -right-1 -top-2 z-10">
										<StatusTooltip status={data?.applicationStatus} />
									</div>
								</div>
								{data?.name}
							</h3>
							{data?.description && <p>{data?.description}</p>}

							<span className="text-sm text-muted-foreground">
								{data?.appName}
							</span>
						</div>
						<div className="flex flex-col h-fit w-fit gap-2">
							<RuntimePlacementStatus
								fallbackIp={serverIp}
								server={data?.server}
								serverId={data?.serverId}
							/>

							<div className="flex flex-row gap-2 justify-end">
								{permissions?.service.create && (
									<UpdateApplication applicationId={applicationId} />
								)}
								{permissions?.service.delete && (
									<DeleteService id={applicationId} type="application" />
								)}
							</div>
						</div>
					</div>
					<div className="space-y-2 py-8 border-t">
						{data?.server?.serverStatus === "inactive" ? (
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
											workspaceId: projectId,
											environmentId,
											serviceType: "application",
											serviceId: applicationId,
											tab: e,
										});
										router.push(newPath);
									}}
									tabs={serviceTabs}
								/>

								{tab === "general" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowGeneralApplication applicationId={applicationId} />
										</div>
									</div>
								)}
								{permissions?.envVars.read && tab === "environment" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowEnvironment applicationId={applicationId} />
										</div>
									</div>
								)}

								{permissions?.monitoring.read && tab === "monitoring" && (
									<div>
										<div className="pt-2.5">
											<div className="flex flex-col gap-4 border rounded-lg p-6">
												{data?.serverId && isCloud ? (
													<ContainerPaidMonitoring
														appName={data?.appName || ""}
														baseUrl={`${data?.serverId ? `http://${data?.server?.ipAddress}:${data?.server?.metricsConfig?.server?.port}` : "http://localhost:4500"}`}
														token={
															data?.server?.metricsConfig?.server?.token || ""
														}
													/>
												) : (
													<>
														{/* {monitoring?.enabledFeatures &&
															isCloud &&
															data?.serverId && (
																<div className="flex flex-row border w-fit p-4 rounded-lg items-center gap-2">
																	<Label className="text-muted-foreground">
																		Metrics source
																	</Label>
																	<Switch
																		checked={toggleMonitoring}
																		onCheckedChange={setToggleMonitoring}
																	/>
																</div>
															)} */}

														{/* {toggleMonitoring ? (
															<ContainerPaidMonitoring
																appName={data?.appName || ""}
																baseUrl={`http://${monitoring?.serverIp}:${monitoring?.metricsConfig?.server?.port}`}
																token={
																	monitoring?.metricsConfig?.server?.token || ""
																}
															/>
														) : ( */}
														<div>
															<ContainerFreeMonitoring
																appName={data?.appName || ""}
															/>
														</div>
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
											<ShowDockerLogs
												appName={data?.appName || ""}
												serverId={data?.serverId || ""}
											/>
										</div>
									</div>
								)}
								{permissions?.schedule.read && tab === "schedules" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowSchedules
												id={applicationId}
												scheduleType="application"
											/>
										</div>
									</div>
								)}
								{permissions?.deployment.read && tab === "deployments" && (
									<div className="w-full pt-2.5">
										<div className="flex flex-col gap-4 border rounded-lg">
											<ShowDeployments
												id={applicationId}
												type="application"
												serverId={data?.serverId || ""}
												refreshToken={data?.refreshToken || ""}
											/>
										</div>
									</div>
								)}
								{permissions?.volumeBackup.read && tab === "volume-backups" && (
									<div className="w-full pt-2.5">
										<div className="flex flex-col gap-4 border rounded-lg">
											<ShowVolumeBackups
												id={applicationId}
												type="application"
												serverId={data?.serverId || ""}
											/>
										</div>
									</div>
								)}
								{permissions?.deployment.read &&
									tab === "preview-deployments" && (
										<div className="w-full">
											<div className="flex flex-col gap-4 pt-2.5">
												<ShowPreviewDeployments applicationId={applicationId} />
											</div>
										</div>
									)}
								{permissions?.domain.read && tab === "domains" && (
									<div className="w-full">
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowDomains id={applicationId} type="application" />
										</div>
									</div>
								)}
								{tab === "patches" && (
									<div className="w-full">
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowPatches id={applicationId} type="application" />
										</div>
									</div>
								)}
								{permissions?.service.create && tab === "advanced" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<AddCommand applicationId={applicationId} />
											<ShowClusterSettings
												id={applicationId}
												type="application"
											/>
											<ShowBuildServer applicationId={applicationId} />
											<ShowResources id={applicationId} type="application" />
											<ShowVolumes id={applicationId} type="application" />
											<ShowRedirects applicationId={applicationId} />
											<ShowSecurity applicationId={applicationId} />
											<ShowPorts applicationId={applicationId} />
											<ShowIngressConfig applicationId={applicationId} />
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
