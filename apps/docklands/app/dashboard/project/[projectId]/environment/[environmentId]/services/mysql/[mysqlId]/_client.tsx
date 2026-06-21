"use client";

import copy from "copy-to-clipboard";
import { HelpCircle, ServerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { UseKeyboardNav } from "@/client/hooks/use-keyboard-nav";
import { ShowEnvironment } from "@/components/dashboard/application/environment/show-environment";
import { ShowDockerLogs } from "@/components/dashboard/application/logs/show";
import { DeleteService } from "@/components/dashboard/compose/delete-service";
import { ShowBackups } from "@/components/dashboard/database/backups/show-backups";
import { ContainerFreeMonitoring } from "@/components/dashboard/monitoring/free/container/show-free-container-monitoring";
import { ContainerPaidMonitoring } from "@/components/dashboard/monitoring/paid/container/show-paid-container-monitoring";
import { ShowExternalMysqlCredentials } from "@/components/dashboard/mysql/general/show-external-mysql-credentials";
import { ShowGeneralMysql } from "@/components/dashboard/mysql/general/show-general-mysql";
import { ShowInternalMysqlCredentials } from "@/components/dashboard/mysql/general/show-internal-mysql-credentials";
import { UpdateMysql } from "@/components/dashboard/mysql/update-mysql";
import { ShowDatabaseAdvancedSettings } from "@/components/dashboard/shared/show-database-advanced-settings";
import { MysqlIcon } from "@/components/icons/data-tools-icons";
import { AdvanceBreadcrumb } from "@/components/shared/advance-breadcrumb";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Label } from "@cloudflare/kumo/components/label";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";

type TabState = "general" | "environment" | "logs" | "monitoring" | "backups" | "advanced";

const MySql = (props: {
	mysqlId: string;
	projectId: string;
	environmentId: string;
	activeTab: TabState;
}) => {
	const [_toggleMonitoring, _setToggleMonitoring] = useState(false);
	const { mysqlId, activeTab } = props;
	const router = useRouter();
	const { projectId, environmentId } = props;
	const [tab, setSab] = useState<TabState>(activeTab);
	const { data } = api.mysql.one.useQuery({ mysqlId });
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
			href: `/dashboard/project/${projectId}/environment/${env.environmentId}`,
		})) || [];

	return (
		<div className="pb-10">
			<UseKeyboardNav forPage="mysql" />
			<AdvanceBreadcrumb />
			<div className="flex flex-col gap-4">
				<div className="w-full">
					<LayerCard className="h-full bg-sidebar  p-2.5 rounded-xl w-full">
						<div className="rounded-xl bg-background shadow-md ">
							<div className="flex flex-row justify-between items-center">
								<div className="flex flex-col">
									<h3 className="text-xl flex flex-row gap-2">
										<div className="relative flex flex-row gap-4">
											<div className="absolute -right-1  -top-2">
												<StatusTooltip status={data?.applicationStatus} />
											</div>

											<MysqlIcon className="h-6 w-6 text-muted-foreground" />
										</div>
										{data?.name}
									</h3>
									{data?.description && (
										<p>{data?.description}</p>
									)}

									<span className="text-sm text-muted-foreground">
										{data?.appName}
									</span>
								</div>
								<div className="flex flex-col h-fit w-fit gap-2">
									<div className="flex flex-row h-fit w-fit gap-2">
										<Button type="button" size="xs"
											className="cursor-pointer"
											onClick={() => {
												const ip = data?.server?.ipAddress || serverIp;
												if (ip) {
													copy(ip);
													toast.success("IP Address Copied!");
												}
											}}
											variant={
												!data?.serverId
													? "secondary"
													: data?.server?.serverStatus === "active"
														? "secondary"
														: "destructive"
											}
										>
											{data?.server?.name || "Docklands Server"}
										</Button>
										{data?.server?.serverStatus === "inactive" && (
											<TooltipProvider delay={0}>
												<Tooltip content={<>
														<span>
															You cannot, deploy this application because the
															server is inactive, please upgrade your plan to
															add more servers.
														</span>
													</>} className="z-[999] w-[300px]"
														align="start"
														side="top"  asChild>
														<Label className="break-all w-fit flex flex-row gap-1 items-center">
															<HelpCircle className="size-4 text-muted-foreground" />
														</Label>
													</Tooltip>
											</TooltipProvider>
										)}
									</div>

									<div className="flex flex-row gap-2 justify-end">
										{permissions?.service.create && (
											<UpdateMysql mysqlId={mysqlId} />
										)}
										{permissions?.service.delete && (
											<DeleteService id={mysqlId} type="mysql" />
										)}
									</div>
								</div>
							</div>
							<div className="space-y-2 py-8 border-t">
								{data?.server?.serverStatus === "inactive" ? (
									<div className="flex h-[55vh] border-2 rounded-xl border-dashed p-4">
										<div className="max-w-3xl mx-auto flex flex-col items-center justify-center self-center gap-3">
											<ServerOff className="size-10 text-muted-foreground self-center" />
											<span className="text-center text-base text-muted-foreground">
												This service is hosted on the server {data.server.name},
												but the server is currently marked inactive. Re-enable
												or update the server from Settings to regain access to
												this service.
											</span>
										</div>
									</div>
								) : (
																		<div className="w-full">
										<Tabs
											value={tab}
											className="w-full overflow-auto"
											onValueChange={(e) => {
												if (e === null) return;
												setSab(e as TabState);
												const newPath = `/dashboard/project/${projectId}/environment/${environmentId}/services/mysql/${mysqlId}?tab=${e}`;

												router.push(newPath);
											}}
											tabs={[
												{ value: "general", label: "General" },
												permissions?.envVars.read ? { value: "environment", label: "Environment" } : null,
												permissions?.logs.read ? { value: "logs", label: "Logs" } : null,
												permissions?.monitoring.read &&
												((data?.serverId && isCloud) || !data?.server)
												? { value: "monitoring", label: "Monitoring" }
												: null,
												{ value: "backups", label: "Backups" },
												permissions?.service.create ? { value: "advanced", label: "Advanced" } : null,
											].filter(Boolean) as { value: string; label: string }[]}
										/>
										{tab === "general" && (
											<div>

											<div className="flex flex-col gap-4 pt-2.5">
												<ShowGeneralMysql mysqlId={mysqlId} />
												<ShowInternalMysqlCredentials mysqlId={mysqlId} />
												<ShowExternalMysqlCredentials mysqlId={mysqlId} />
											</div>
											</div>
										)}
										{permissions?.envVars.read && tab === "environment" && (
											<div className="w-full">

												<div className="flex flex-col gap-4 pt-2.5">
													<ShowEnvironment id={mysqlId} type="mysql" />
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
																	data?.server?.metricsConfig?.server?.token ||
																	""
																}
															/>
														) : (
															<>
																<ContainerFreeMonitoring
																	appName={data?.appName || ""}
																/>
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
													id={mysqlId}
													databaseType="mysql"
													backupType="database"
												/>
											</div>
											</div>
										)}
										{permissions?.service.create && tab === "advanced" && (
											<div>

												<div className="flex flex-col gap-4 pt-2.5">
													<ShowDatabaseAdvancedSettings
														id={mysqlId}
														type="mysql"
													/>
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</LayerCard>
				</div>
			</div>
		</div>
	);
};

export default MySql;
