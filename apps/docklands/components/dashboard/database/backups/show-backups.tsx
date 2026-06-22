import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	ClipboardList,
	Database,
	DatabaseBackup,
	Play,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import {
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
} from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { cn } from "@/shared/utils";
import type { ServiceType } from "../../application/advanced/show-resources";
import { ShowDeploymentsModal } from "../../application/deployments/show-deployments-modal";
import { HandleBackup } from "./handle-backup";
import { RestoreBackup } from "./restore-backup";

interface Props {
	id: string;
	databaseType?: Exclude<ServiceType, "application" | "redis"> | "web-server";
	backupType?: "database" | "compose";
}
export const ShowBackups = ({
	id,
	databaseType,
	backupType = "database",
}: Props) => {
	const [activeManualBackup, setActiveManualBackup] = useState<
		string | undefined
	>();
	const queryMap =
		backupType === "database"
			? {
					mariadb: () =>
						api.mariadb.one.useQuery({ mariadbId: id }, { enabled: !!id }),
					mongo: () =>
						api.mongo.one.useQuery({ mongoId: id }, { enabled: !!id }),
					mysql: () =>
						api.mysql.one.useQuery({ mysqlId: id }, { enabled: !!id }),
					postgres: () =>
						api.postgres.one.useQuery({ postgresId: id }, { enabled: !!id }),
					libsql: () =>
						api.libsql.one.useQuery({ libsqlId: id }, { enabled: !!id }),
					"web-server": () => api.user.getBackups.useQuery(),
				}
			: {
					compose: () =>
						api.compose.one.useQuery({ composeId: id }, { enabled: !!id }),
				};
	const { data } = api.destination.all.useQuery();
	const key = backupType === "database" ? databaseType : "compose";
	const query = queryMap[key as keyof typeof queryMap];
	const { data: postgres, refetch } = query
		? query()
		: api.mongo.one.useQuery({ mongoId: id }, { enabled: !!id });

	const mutationMap =
		backupType === "database"
			? {
					mariadb: api.backup.manualBackupMariadb.useMutation(),
					mongo: api.backup.manualBackupMongo.useMutation(),
					mysql: api.backup.manualBackupMySql.useMutation(),
					postgres: api.backup.manualBackupPostgres.useMutation(),
					libsql: api.backup.manualBackupLibsql.useMutation(),
					"web-server": api.backup.manualBackupWebServer.useMutation(),
				}
			: {
					compose: api.backup.manualBackupCompose.useMutation(),
				};

	const mutation = mutationMap[key as keyof typeof mutationMap];

	const { mutateAsync: manualBackup, isPending: isManualBackup } = mutation
		? mutation
		: api.backup.manualBackupMongo.useMutation();

	const { mutateAsync: deleteBackup, isPending: isRemoving } =
		api.backup.remove.useMutation();

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row justify-between gap-4  flex-wrap">
				<div className="flex flex-col gap-0.5">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<Database className="size-6 text-kumo-subtle" />
						Backups
					</h3>
					<p>
						Add backups to your database to save the data to a different
						provider.
					</p>
				</div>

				{postgres && postgres?.backups?.length > 0 && (
					<div className="flex flex-col lg:flex-row gap-4 w-full lg:w-auto">
						{databaseType !== "web-server" && (
							<HandleBackup
								id={id}
								databaseType={databaseType}
								backupType={backupType}
								refetch={refetch}
							/>
						)}
						<RestoreBackup
							id={id}
							databaseType={databaseType}
							backupType={backupType}
							runtimeWorkerId={
								"runtimeWorkerId" in postgres
									? postgres.runtimeWorkerId
									: undefined
							}
						/>
					</div>
				)}
			</div>
			<div className="flex flex-col gap-4">
				{data?.length === 0 ? (
					<div className="flex flex-col items-center gap-3 min-h-[35vh] justify-center">
						<DatabaseBackup className="size-8 text-kumo-subtle" />
						<span className="text-base text-kumo-subtle text-center">
							To create a backup it is required to set at least 1 provider.
							Please, go to{" "}
							<Link
								href="/dashboard/settings/storage"
								className="text-kumo-default"
							>
								Storage providers
							</Link>{" "}
							to do so.
						</span>
					</div>
				) : (
					<div className="flex flex-col gap-4 w-full">
						{postgres?.backups.length === 0 ? (
							<div className="flex w-full flex-col items-center justify-center gap-3 pt-10">
								<DatabaseBackup className="size-8 text-kumo-subtle" />
								<span className="text-base text-kumo-subtle">
									No backups configured
								</span>
								<div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
									<HandleBackup
										id={id}
										databaseType={databaseType}
										backupType={backupType}
										refetch={refetch}
									/>
									<RestoreBackup
										id={id}
										databaseType={databaseType}
										backupType={backupType}
										runtimeWorkerId={
											"runtimeWorkerId" in postgres
												? postgres.runtimeWorkerId
												: undefined
										}
									/>
								</div>
							</div>
						) : (
							<div className="flex flex-col pt-2 gap-4">
								{backupType === "compose" && (
									<AlertBlock title="Compose Backups">
										Make sure the compose is running before creating a backup.
									</AlertBlock>
								)}
								<div className="flex flex-col gap-6">
									{postgres?.backups.map((backup) => {
										const runtimeWorkerId =
											"runtimeWorkerId" in postgres
												? postgres.runtimeWorkerId
												: undefined;

										return (
											<div key={backup.backupId}>
												<div className="flex w-full flex-col md:flex-row md:items-start justify-between gap-4 border rounded-lg p-4 hover:bg-kumo-fill/50 transition-colors">
													<div className="flex flex-col w-full gap-4">
														<div className="flex items-center gap-3">
															{backup.backupType === "compose" && (
																<div className="flex items-center justify-center size-10 rounded-lg">
																	{backup.databaseType === "postgres" && (
																		<PostgresqlIcon className="size-7" />
																	)}
																	{backup.databaseType === "mysql" && (
																		<MysqlIcon className="size-7" />
																	)}
																	{backup.databaseType === "mariadb" && (
																		<MariadbIcon className="size-7" />
																	)}
																	{backup.databaseType === "mongo" && (
																		<MongodbIcon className="size-7" />
																	)}
																</div>
															)}
															<div className="flex flex-col gap-1">
																{backup.backupType === "compose" && (
																	<div className="flex items-center gap-2">
																		<h3 className="font-medium">
																			{backup.serviceName}
																		</h3>
																		<span className="px-1.5 py-0.5 rounded-full bg-kumo-fill text-xs font-medium capitalize">
																			{backup.databaseType}
																		</span>
																	</div>
																)}
																<div className="flex items-center gap-2">
																	<div
																		className={cn(
																			"size-1.5 rounded-full",
																			backup.enabled
																				? "bg-kumo-success"
																				: "bg-kumo-danger",
																		)}
																	/>
																	<span className="text-xs text-kumo-subtle">
																		{backup.enabled ? "Active" : "Inactive"}
																	</span>
																</div>
															</div>
														</div>

														<div className="flex flex-wrap gap-x-8 gap-y-2">
															<div className="min-w-[200px]">
																<span className="text-sm font-medium text-kumo-subtle">
																	Destination
																</span>
																<p className="font-medium text-sm mt-0.5">
																	{backup.destination.name}
																</p>
															</div>

															<div className="min-w-[150px]">
																<span className="text-sm font-medium text-kumo-subtle">
																	Database
																</span>
																<p className="font-medium text-sm mt-0.5">
																	{backup.database}
																</p>
															</div>

															<div className="min-w-[120px]">
																<span className="text-sm font-medium text-kumo-subtle">
																	Schedule
																</span>
																<p className="font-medium text-sm mt-0.5">
																	{backup.schedule}
																</p>
															</div>

															<div className="min-w-[150px]">
																<span className="text-sm font-medium text-kumo-subtle">
																	Prefix Storage
																</span>
																<p className="font-medium text-sm mt-0.5">
																	{backup.prefix}
																</p>
															</div>

															<div className="min-w-[100px]">
																<span className="text-sm font-medium text-kumo-subtle">
																	Keep Latest
																</span>
																<p className="font-medium text-sm mt-0.5">
																	{backup.keepLatestCount || "All"}
																</p>
															</div>
														</div>
													</div>

													<div className="flex flex-row md:flex-col gap-1.5">
														<ShowDeploymentsModal
															id={backup.backupId}
															type="backup"
															runtimeWorkerId={runtimeWorkerId || undefined}
														>
															<Button
																aria-label="View backup build history"
																variant="ghost"
																shape="square"
																className="size-8"
															>
																<ClipboardList className="size-4  transition-colors " />
															</Button>
														</ShowDeploymentsModal>
														<TooltipProvider delay={0}>
															<Tooltip content={<>Run Manual Backup</>} asChild>
																<Button
																	aria-label="Run backup now"
																	type="button"
																	variant="ghost"
																	shape="square"
																	className="size-8"
																	loading={
																		isManualBackup &&
																		activeManualBackup === backup.backupId
																	}
																	onClick={async () => {
																		setActiveManualBackup(backup.backupId);
																		await manualBackup({
																			backupId: backup.backupId as string,
																		})
																			.then(async () => {
																				toast.success(
																					"Manual Backup Successful",
																				);
																			})
																			.catch(() => {
																				toast.error(
																					"Error creating the manual backup",
																				);
																			});
																		setActiveManualBackup(undefined);
																	}}
																>
																	<Play className="size-4 " />
																</Button>
															</Tooltip>
														</TooltipProvider>

														<HandleBackup
															backupType={backup.backupType}
															backupId={backup.backupId}
															databaseType={backup.databaseType}
															refetch={refetch}
														/>
														<DialogAction
															title="Delete Backup"
															description="Are you sure you want to delete this backup?"
															type="destructive"
															onClick={async () => {
																await deleteBackup({
																	backupId: backup.backupId,
																})
																	.then(() => {
																		refetch();
																		toast.success(
																			"Backup deleted successfully",
																		);
																	})
																	.catch(() => {
																		toast.error("Error deleting backup");
																	});
															}}
														>
															<Button
																aria-label="Delete backup"
																variant="ghost"
																shape="square"
																className="group hover:bg-kumo-danger/10 size-8"
																loading={isRemoving}
															>
																<Trash2 className="size-4 text-kumo-default group-hover:text-kumo-danger" />
															</Button>
														</DialogAction>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</LayerCard>
	);
};
