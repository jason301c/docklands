import { Button } from "@cloudflare/kumo/components/button";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { ClipboardList, DatabaseBackup, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { ShowDeploymentsModal } from "@/components/dashboard/application/deployments/show-deployments-modal";
import { DialogAction } from "@/components/shared/dialog-action";
import { QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { cn } from "@/shared/utils";
import { HandleServiceDatabaseBackup } from "./handle-service-database-backup";

const logger = createClientLogger("compose");

type ServiceDatabaseEngine = "postgres" | "mariadb" | "mysql" | "mongo";

interface Props {
	serviceDatabaseId: string;
	engine: ServiceDatabaseEngine;
	serviceName: string;
	runtimeWorkerId?: string;
}

export const ShowServiceDatabaseBackups = ({
	serviceDatabaseId,
	engine,
	serviceName,
	runtimeWorkerId,
}: Props) => {
	const [activeManualBackup, setActiveManualBackup] = useState<
		string | undefined
	>();

	const { data: destinations } = api.destination.all.useQuery();
	const backupsQuery = api.serviceDatabase.backups.useQuery(
		{ serviceDatabaseId },
		{ enabled: !!serviceDatabaseId },
	);
	const { refetch } = backupsQuery;

	const { mutateAsync: manualBackup, isPending: isManualBackup } =
		api.serviceDatabase.manualBackup.useMutation();
	const { mutateAsync: deleteBackup, isPending: isRemoving } =
		api.backup.remove.useMutation();

	if (destinations?.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 py-8 justify-center">
				<DatabaseBackup className="size-8 text-kumo-subtle" />
				<span className="text-base text-kumo-subtle text-center">
					To create a backup it is required to set at least 1 provider. Please,
					go to{" "}
					<Link
						href="/dashboard/settings/storage"
						className="text-kumo-default"
					>
						Storage providers
					</Link>{" "}
					to do so.
				</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 w-full">
			<QueryState
				query={backupsQuery}
				isEmpty={(backups) => backups.length === 0}
				errorTitle="Failed to load backups"
				empty={
					<div className="flex w-full flex-col items-center justify-center gap-3 py-6">
						<DatabaseBackup className="size-8 text-kumo-subtle" />
						<span className="text-base text-kumo-subtle">
							No backups configured
						</span>
						<HandleServiceDatabaseBackup
							serviceDatabaseId={serviceDatabaseId}
							engine={engine}
							serviceName={serviceName}
							refetch={refetch}
						/>
					</div>
				}
			>
				{(backups) => (
					<div className="flex flex-col gap-4">
						<div className="flex justify-end">
							<HandleServiceDatabaseBackup
								serviceDatabaseId={serviceDatabaseId}
								engine={engine}
								serviceName={serviceName}
								refetch={refetch}
							/>
						</div>
						<div className="flex flex-col gap-6">
							{backups.map((backup) => (
								<div key={backup.backupId}>
									<div className="flex w-full flex-col md:flex-row md:items-start justify-between gap-4 border rounded-lg p-4 hover:bg-kumo-fill/50 transition-colors">
										<div className="flex flex-col w-full gap-4">
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
													<ClipboardList className="size-4 transition-colors" />
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
															await manualBackup({ backupId: backup.backupId })
																.then(() => {
																	toast.success("Manual Backup Successful");
																})
																.catch((err) => {
																	logger.error(
																		"Failed to create the manual backup",
																		err,
																	);
																	toast.error(
																		"Error creating the manual backup",
																	);
																});
															setActiveManualBackup(undefined);
														}}
													>
														<Play className="size-4" />
													</Button>
												</Tooltip>
											</TooltipProvider>

											<HandleServiceDatabaseBackup
												serviceDatabaseId={serviceDatabaseId}
												engine={engine}
												serviceName={serviceName}
												backupId={backup.backupId}
												refetch={refetch}
											/>
											<DialogAction
												title="Delete Backup"
												description="Are you sure you want to delete this backup?"
												type="destructive"
												onClick={async () => {
													await deleteBackup({ backupId: backup.backupId })
														.then(() => {
															refetch();
															toast.success("Backup deleted successfully");
														})
														.catch((err) => {
															logger.error("Failed to delete backup", err);
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
							))}
						</div>
					</div>
				)}
			</QueryState>
		</div>
	);
};
