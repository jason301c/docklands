import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	ClipboardList,
	DatabaseBackup,
	Loader2,
	Play,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { ShowDeploymentsModal } from "../deployments/show-deployments-modal";
import { HandleVolumeBackups } from "./handle-volume-backups";
import { RestoreVolumeBackups } from "./restore-volume-backups";

const logger = createClientLogger("volume-backup");

interface Props {
	id: string;
	type?: "application" | "compose";
	runtimeWorkerId?: string;
}

export const ShowVolumeBackups = ({
	id,
	type = "application",
	runtimeWorkerId,
}: Props) => {
	const [runningBackups, setRunningBackups] = useState<Set<string>>(new Set());
	const volumeBackupsQuery = api.volumeBackups.list.useQuery(
		{
			id: id || "",
			volumeBackupType: type,
		},
		{
			enabled: !!id,
		},
	);
	const { data: volumeBackups, refetch: refetchVolumeBackups } =
		volumeBackupsQuery;
	const utils = api.useUtils();
	const { mutateAsync: deleteVolumeBackup, isPending: isDeleting } =
		api.volumeBackups.delete.useMutation();
	const { mutateAsync: runManually } =
		api.volumeBackups.runManually.useMutation();

	const handleRunManually = async (volumeBackupId: string) => {
		setRunningBackups((prev) => new Set(prev).add(volumeBackupId));
		try {
			await runManually({ volumeBackupId });
			toast.success("Volume backup run successfully");
			await refetchVolumeBackups();
		} catch (err) {
			logger.error("Failed to run volume backup", err);
			toast.error("Error running volume backup");
		} finally {
			setRunningBackups((prev) => {
				const newSet = new Set(prev);
				newSet.delete(volumeBackupId);
				return newSet;
			});
		}
	};

	return (
		<SectionCard
			title="Volume Backups"
			className="h-full min-h-[50vh]"
			actions={
				volumeBackups && volumeBackups.length > 0 ? (
					<>
						<HandleVolumeBackups id={id} volumeBackupType={type} />
						<RestoreVolumeBackups
							id={id}
							type={type}
							runtimeWorkerId={runtimeWorkerId}
						/>
					</>
				) : null
			}
		>
			<div className="px-0">
				<QueryState
					query={volumeBackupsQuery}
					isEmpty={(volumeBackups) => volumeBackups.length === 0}
					loadingLabel="Loading volume backups..."
					empty={
						<div className="flex flex-col gap-2 items-center justify-center py-12 rounded-lg">
							<DatabaseBackup className="size-8 mb-4 text-kumo-subtle" />
							<p className="text-lg font-medium text-kumo-subtle">
								No volume backups
							</p>
							<p className="text-sm text-kumo-subtle mt-1">
								Create your first volume backup to automate your workflows
							</p>
							<div className="flex items-center gap-2">
								<HandleVolumeBackups id={id} volumeBackupType={type} />
								<RestoreVolumeBackups
									id={id}
									type={type}
									runtimeWorkerId={runtimeWorkerId}
								/>
							</div>
						</div>
					}
					errorTitle="Failed to load volume backups"
				>
					{(volumeBackups) => (
						<div className="grid xl:grid-cols-2 gap-4 grid-cols-1 h-full">
							{volumeBackups.map((volumeBackup) => {
								const runtimeWorkerId =
									volumeBackup.application?.runtimeWorkerId ||
									volumeBackup.database?.runtimeWorkerId ||
									volumeBackup.compose?.runtimeWorkerId;
								return (
									<div
										key={volumeBackup.volumeBackupId}
										className="flex flex-col sm:flex-row sm:items-center flex-wrap sm:flex-nowrap gap-y-2 justify-between rounded-lg border p-3 transition-colors bg-kumo-fill/50 w-full"
									>
										<div className="flex items-start gap-3 w-full sm:w-auto">
											<div className="flex h-9 w-9 items-center justify-center rounded-full bg-kumo-brand/5">
												<DatabaseBackup className="size-4 text-kumo-brand/70" />
											</div>
											<div className="space-y-1.5 w-full sm:w-auto">
												<div className="flex items-center gap-2">
													<h3 className="text-sm font-medium leading-none">
														{volumeBackup.name}
													</h3>
													<Badge
														variant={
															volumeBackup.enabled ? "secondary" : "secondary"
														}
														className="text-[10px] px-1 py-0"
													>
														{volumeBackup.enabled ? "Enabled" : "Disabled"}
													</Badge>
												</div>
												<div className="flex items-center gap-2 text-sm text-kumo-subtle">
													<Badge
														variant="outline"
														className="font-mono text-[10px] bg-transparent"
													>
														Cron: {volumeBackup.cronExpression}
													</Badge>
												</div>
											</div>
										</div>
										<div className="flex items-center gap-1.5 mt-2 sm:mt-0 sm:ml-3">
											<ShowDeploymentsModal
												id={volumeBackup.volumeBackupId}
												type="volumeBackup"
												runtimeWorkerId={runtimeWorkerId || undefined}
											>
												<Button
													aria-label="View volume backup build history"
													variant="ghost"
													shape="square"
												>
													<ClipboardList className="size-4 transition-colors" />
												</Button>
											</ShowDeploymentsModal>
											<TooltipProvider delay={0}>
												<Tooltip
													content={<>Run Manual Volume Backup</>}
													asChild
												>
													<Button
														aria-label="Run volume backup now"
														type="button"
														variant="ghost"
														shape="square"
														disabled={runningBackups.has(
															volumeBackup.volumeBackupId,
														)}
														onClick={() =>
															handleRunManually(volumeBackup.volumeBackupId)
														}
													>
														{runningBackups.has(volumeBackup.volumeBackupId) ? (
															<Loader2 className="size-4 animate-spin" />
														) : (
															<Play className="size-4 transition-colors" />
														)}
													</Button>
												</Tooltip>
											</TooltipProvider>
											<HandleVolumeBackups
												volumeBackupId={volumeBackup.volumeBackupId}
												id={id}
												volumeBackupType={type}
											/>
											<DialogAction
												title="Delete Volume Backup"
												description="Are you sure you want to delete this volume backup?"
												type="destructive"
												onClick={async () => {
													await deleteVolumeBackup({
														volumeBackupId: volumeBackup.volumeBackupId,
													})
														.then(() => {
															utils.volumeBackups.list.invalidate({
																id,
																volumeBackupType: type,
															});
															toast.success(
																"Volume backup deleted successfully",
															);
														})
														.catch((err) => {
															logger.error(
																"Failed to delete volume backup",
																err,
															);
															toast.error("Error deleting volume backup");
														});
												}}
											>
												<Button
													aria-label="Delete volume backup"
													variant="ghost"
													shape="square"
													className="group hover:bg-kumo-danger/10"
													loading={isDeleting}
												>
													<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
												</Button>
											</DialogAction>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</QueryState>
			</div>
		</SectionCard>
	);
};
