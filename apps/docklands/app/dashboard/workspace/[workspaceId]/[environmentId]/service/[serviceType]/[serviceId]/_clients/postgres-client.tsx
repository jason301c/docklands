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
import { ShowExternalPostgresCredentials } from "@/components/dashboard/postgres/general/show-external-postgres-credentials";
import { ShowGeneralPostgres } from "@/components/dashboard/postgres/general/show-general-postgres";
import { ShowInternalPostgresCredentials } from "@/components/dashboard/postgres/general/show-internal-postgres-credentials";
import { UpdatePostgres } from "@/components/dashboard/postgres/update-postgres";
import {
	RuntimePlacementStatus,
	RuntimeWorkerInactiveState,
} from "@/components/dashboard/service/runtime-placement-status";
import { ShowDatabaseAdvancedSettings } from "@/components/dashboard/shared/show-database-advanced-settings";
import { PostgresqlIcon } from "@/components/icons/data-tools-icons";
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

const Postgresql = (props: {
	postgresId: string;
	workspaceId: string;
	environmentId: string;
	activeTab: TabState;
}) => {
	const [_toggleMonitoring, _setToggleMonitoring] = useState(false);
	const { postgresId, activeTab } = props;
	const router = useRouter();
	const { workspaceId, environmentId } = props;
	const [tab, setSab] = useState<TabState>(activeTab);
	const { data } = api.postgres.one.useQuery({ postgresId });
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

	return (
		<div className="pb-10">
			<UseKeyboardNav forPage="postgres" />
			<AdvanceBreadcrumb />
			<div className="w-full">
				<div className="rounded-lg border bg-kumo-canvas p-6">
					<div className="flex flex-row justify-between items-center">
						<div className="flex flex-col">
							<h3 className="text-xl font-semibold flex items-center gap-2">
								<div className="relative flex flex-row gap-4">
									<div className="absolute -right-1  -top-2">
										<StatusTooltip status={data?.applicationStatus} />
									</div>

									<PostgresqlIcon className="h-6 w-6 text-kumo-subtle" />
								</div>
								{data?.name}
							</h3>
							{data?.description && <p>{data?.description}</p>}

							<span className="text-sm text-kumo-subtle">{data?.appName}</span>
						</div>
						<div className="flex flex-col h-fit w-fit gap-2">
							<RuntimePlacementStatus
								fallbackIp={serverIp}
								runtimeWorker={data?.runtimeWorker}
								runtimeWorkerId={data?.runtimeWorkerId}
							/>

							<div className="flex flex-row gap-2 justify-end">
								{permissions?.service.create && (
									<UpdatePostgres postgresId={postgresId} />
								)}
								{permissions?.service.delete && (
									<DeleteService id={postgresId} type="postgres" />
								)}
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
										setSab(e as TabState);
										const newPath = workspaceServicePath({
											workspaceId: workspaceId,
											environmentId,
											serviceType: "postgres",
											serviceId: postgresId,
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
											((data?.runtimeWorkerId && isCloud) ||
												!data?.runtimeWorker)
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
											<ShowGeneralPostgres postgresId={postgresId} />
											<ShowInternalPostgresCredentials
												postgresId={postgresId}
											/>
											<ShowExternalPostgresCredentials
												postgresId={postgresId}
											/>
										</div>
									</div>
								)}
								{permissions?.envVars.read && tab === "environment" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowEnvironment id={postgresId} type="postgres" />
										</div>
									</div>
								)}
								{permissions?.monitoring.read && tab === "monitoring" && (
									<div>
										<div className="pt-2.5">
											<div className="flex flex-col gap-4 border rounded-lg p-6">
												{data?.runtimeWorkerId && isCloud ? (
													<ContainerPaidMonitoring
														appName={data?.appName || ""}
														baseUrl={`${
															data?.runtimeWorkerId
																? `http://${data?.runtimeWorker?.ipAddress}:${data?.runtimeWorker?.metricsConfig?.runtimeWorker?.port}`
																: "http://localhost:4500"
														}`}
														token={
															data?.runtimeWorker?.metricsConfig?.runtimeWorker
																?.token || ""
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
												runtimeWorkerId={data?.runtimeWorkerId || ""}
												appName={data?.appName || ""}
											/>
										</div>
									</div>
								)}
								{tab === "backups" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowBackups
												id={postgresId}
												databaseType="postgres"
												backupType="database"
											/>
										</div>
									</div>
								)}
								{permissions?.service.create && tab === "advanced" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowDatabaseAdvancedSettings
												id={postgresId}
												type="postgres"
											/>
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

export default Postgresql;
