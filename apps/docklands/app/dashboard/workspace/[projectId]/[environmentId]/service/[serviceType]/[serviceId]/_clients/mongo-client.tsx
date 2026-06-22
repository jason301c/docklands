"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { UseKeyboardNav } from "@/client/hooks/use-keyboard-nav";
import { ShowEnvironment } from "@/components/dashboard/application/environment/show-environment";
import { ShowDockerLogs } from "@/components/dashboard/application/logs/show";
import { DeleteService } from "@/components/dashboard/compose/delete-service";
import { ShowBackups } from "@/components/dashboard/database/backups/show-backups";
import { ContainerFreeMonitoring } from "@/components/dashboard/metrics/free/container/show-free-container-monitoring";
import { ContainerPaidMonitoring } from "@/components/dashboard/metrics/paid/container/show-paid-container-monitoring";
import { ShowExternalMongoCredentials } from "@/components/dashboard/mongo/general/show-external-mongo-credentials";
import { ShowGeneralMongo } from "@/components/dashboard/mongo/general/show-general-mongo";
import { ShowInternalMongoCredentials } from "@/components/dashboard/mongo/general/show-internal-mongo-credentials";
import { UpdateMongo } from "@/components/dashboard/mongo/update-mongo";
import {
	RuntimePlacementStatus,
	RuntimeWorkerInactiveState,
} from "@/components/dashboard/service/runtime-placement-status";
import { ShowDatabaseAdvancedSettings } from "@/components/dashboard/shared/show-database-advanced-settings";
import { MongodbIcon } from "@/components/icons/data-tools-icons";
import { AdvanceBreadcrumb } from "@/components/shared/advance-breadcrumb";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import {
	workspaceEnvironmentPath,
	workspaceServicePath,
} from "@/shared/routes";

type TabState =
	| "general"
	| "environment"
	| "logs"
	| "monitoring"
	| "backups"
	| "advanced";

const Mongo = (props: {
	mongoId: string;
	projectId: string;
	environmentId: string;
	activeTab: TabState;
}) => {
	const [_toggleMonitoring, _setToggleMonitoring] = useState(false);
	const { mongoId, activeTab } = props;
	const router = useRouter();
	const { projectId, environmentId } = props;
	const [tab, setSab] = useState<TabState>(activeTab);
	const { data } = api.mongo.one.useQuery({ mongoId });

	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: serverIp } = api.settings.getIp.useQuery();
	const { data: environments } = api.environment.byProjectId.useQuery({
		projectId: data?.environment?.projectId || "",
	});
	const environmentDropdownItems =
		environments?.map((env) => ({
			name: env.name,
			href: workspaceEnvironmentPath({
				projectId,
				environmentId: env.environmentId,
			}),
		})) || [];

	return (
		<div className="pb-10">
			<UseKeyboardNav forPage="mongodb" />
			<AdvanceBreadcrumb />
			<div className="w-full">
				<div className="rounded-lg border bg-background p-6">
					<div className="flex flex-row justify-between items-center">
						<div className="flex flex-col">
							<h3 className="text-xl flex flex-row gap-2">
								<div className="relative flex flex-row gap-4">
									<div className="absolute -right-1  -top-2">
										<StatusTooltip status={data?.applicationStatus} />
									</div>

									<MongodbIcon className="h-6 w-6 text-muted-foreground" />
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
									<UpdateMongo mongoId={mongoId} />
								)}
								{permissions?.service.delete && (
									<DeleteService id={mongoId} type="mongo" />
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
										setSab(e as TabState);
										const newPath = workspaceServicePath({
											projectId,
											environmentId,
											serviceType: "mongo",
											serviceId: mongoId,
											tab: e,
										});

										router.push(newPath);
									}}
									tabs={
										[
											{ value: "general", label: "General" },
											permissions?.envVars.read
												? { value: "environment", label: "Environment" }
												: null,
											permissions?.logs.read
												? { value: "logs", label: "Logs" }
												: null,
											permissions?.monitoring.read &&
											((data?.serverId && isCloud) || !data?.server)
												? { value: "monitoring", label: "Metrics" }
												: null,
											{ value: "backups", label: "Backups" },
											permissions?.service.create
												? { value: "advanced", label: "Advanced" }
												: null,
										].filter(Boolean) as { value: string; label: string }[]
									}
								/>
								{tab === "general" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowGeneralMongo mongoId={mongoId} />
											<ShowInternalMongoCredentials mongoId={mongoId} />
											<ShowExternalMongoCredentials mongoId={mongoId} />
										</div>
									</div>
								)}
								{permissions?.envVars.read && tab === "environment" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowEnvironment id={mongoId} type="mongo" />
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
														{/* {monitoring?.enabledFeatures && (
															<div className="flex flex-row border w-fit p-4 rounded-lg items-center gap-2">
																<Label className="text-muted-foreground">
																	Metrics source
																</Label>
																<Switch
																	checked={toggleMonitoring}
																	onCheckedChange={setToggleMonitoring}
																/>
															</div>
														)}

														{toggleMonitoring ? (
															<ContainerPaidMonitoring
																appName={data?.appName || ""}
																baseUrl={`http://${monitoring?.serverIp}:${monitoring?.metricsConfig?.server?.port}`}
																token={
																	monitoring?.metricsConfig?.server?.token || ""
																}
															/>
														) : (
															<div> */}
														<ContainerFreeMonitoring
															appName={data?.appName || ""}
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
										<div className="flex flex-col gap-4  pt-2.5">
											<ShowDockerLogs
												serverId={data?.serverId || ""}
												appName={data?.appName || ""}
											/>
										</div>
									</div>
								)}
								{tab === "backups" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowBackups
												id={mongoId}
												databaseType="mongo"
												backupType="database"
											/>
										</div>
									</div>
								)}
								{permissions?.service.create && tab === "advanced" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowDatabaseAdvancedSettings id={mongoId} type="mongo" />
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

export default Mongo;
