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
import { ShowExternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-external-database-credentials";
import { ShowGeneralDatabase } from "@/components/dashboard/database-service/general/show-general-database";
import { ShowInternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-internal-database-credentials";
import { UpdateDatabase } from "@/components/dashboard/database-service/update-database";
import { ContainerFreeMonitoring } from "@/components/dashboard/metrics/free/container/show-free-container-monitoring";
import {
	RuntimePlacementStatus,
	RuntimeWorkerInactiveState,
} from "@/components/dashboard/service/runtime-placement-status";
import { ShowDatabaseAdvancedSettings } from "@/components/dashboard/shared/show-database-advanced-settings";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { AdvanceBreadcrumb } from "@/components/shared/advance-breadcrumb";
import { StatusTooltip } from "@/components/shared/status-tooltip";
import {
	workspaceEnvironmentPath,
	workspaceServicePath,
} from "@/shared/routes";
import type { WorkspaceVariableSourceType } from "@/shared/workspace-graph";

type TabState =
	| "general"
	| "environment"
	| "logs"
	| "monitoring"
	| "backups"
	| "advanced";

const ENGINE_ICONS: Record<
	WorkspaceVariableSourceType,
	(props: { className?: string }) => React.JSX.Element
> = {
	postgres: PostgresqlIcon,
	mysql: MysqlIcon,
	mariadb: MariadbIcon,
	mongo: MongodbIcon,
	redis: RedisIcon,
	libsql: LibsqlIcon,
};

/**
 * Maps a database engine to its `UseKeyboardNav` page key. Engine keys match the
 * page keys except `mongo`, whose keyboard-nav page is named `mongodb`.
 */
const ENGINE_KEYBOARD_PAGE: Record<
	WorkspaceVariableSourceType,
	"libsql" | "mariadb" | "mongodb" | "mysql" | "postgres" | "redis"
> = {
	postgres: "postgres",
	mysql: "mysql",
	mariadb: "mariadb",
	mongo: "mongodb",
	redis: "redis",
	libsql: "libsql",
};

/** Engines that support logical (dump-based) backups. Redis/libSQL do not. */
const BACKUP_ENGINES = ["postgres", "mysql", "mariadb", "mongo"] as const;
type BackupEngine = (typeof BACKUP_ENGINES)[number];
const supportsBackups = (
	engine: WorkspaceVariableSourceType,
): engine is BackupEngine =>
	(BACKUP_ENGINES as readonly string[]).includes(engine);

const DatabaseClient = (props: {
	databaseId: string;
	workspaceId: string;
	environmentId: string;
	activeTab: TabState;
}) => {
	const [_toggleMonitoring, _setToggleMonitoring] = useState(false);
	const { databaseId, activeTab } = props;
	const router = useRouter();
	const { workspaceId, environmentId } = props;
	const [tab, setSab] = useState<TabState>(activeTab);
	const { data } = api.database.one.useQuery({ databaseId });
	const { data: permissions } = api.user.getPermissions.useQuery();

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

	const EngineIcon = data?.engine ? ENGINE_ICONS[data.engine] : null;
	const backupEngine =
		data?.engine && supportsBackups(data.engine) ? data.engine : null;

	return (
		<div className="pb-10">
			<UseKeyboardNav
				forPage={data?.engine ? ENGINE_KEYBOARD_PAGE[data.engine] : "postgres"}
			/>
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

									{EngineIcon && (
										<EngineIcon className="h-6 w-6 text-kumo-subtle" />
									)}
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
									<UpdateDatabase databaseId={databaseId} />
								)}
								{permissions?.service.delete && data?.engine && (
									<DeleteService id={databaseId} type={data.engine} />
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
											serviceType: data?.engine ?? "postgres",
											serviceId: databaseId,
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
											permissions?.monitoring.read && !data?.runtimeWorker
												? { value: "monitoring", label: "Metrics" }
												: null,
											backupEngine
												? { value: "backups", label: "Backups" }
												: null,
											permissions?.service.create
												? { value: "advanced", label: "Advanced" }
												: null,
										].filter(Boolean) as { value: string; label: string }[]
									}
								/>
								{tab === "general" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowGeneralDatabase databaseId={databaseId} />
											<ShowInternalDatabaseCredentials
												databaseId={databaseId}
											/>
											<ShowExternalDatabaseCredentials
												databaseId={databaseId}
											/>
										</div>
									</div>
								)}
								{permissions?.envVars.read &&
									tab === "environment" &&
									data?.engine && (
										<div>
											<div className="flex flex-col gap-4 pt-2.5">
												<ShowEnvironment id={databaseId} type={data.engine} />
											</div>
										</div>
									)}
								{permissions?.monitoring.read && tab === "monitoring" && (
									<div>
										<div className="pt-2.5">
											<div className="flex flex-col gap-4 border rounded-lg p-6">
												<ContainerFreeMonitoring
													appName={data?.appName || ""}
												/>
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
								{backupEngine && tab === "backups" && (
									<div>
										<div className="flex flex-col gap-4 pt-2.5">
											<ShowBackups
												id={databaseId}
												databaseType={backupEngine}
												backupType="database"
											/>
										</div>
									</div>
								)}
								{permissions?.service.create &&
									tab === "advanced" &&
									data?.engine && (
										<div>
											<div className="flex flex-col gap-4 pt-2.5">
												<ShowDatabaseAdvancedSettings
													id={databaseId}
													type={data.engine}
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

export default DatabaseClient;
