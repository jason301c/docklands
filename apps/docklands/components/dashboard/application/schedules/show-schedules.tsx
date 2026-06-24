import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	ClipboardList,
	Clock,
	Loader2,
	Play,
	Terminal,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { toast } from "@/components/shared/toast";
import { ShowDeploymentsModal } from "../deployments/show-deployments-modal";
import { HandleSchedules } from "./handle-schedules";

const logger = createClientLogger("schedules");

interface Props {
	id: string;
	scheduleType?:
		| "application"
		| "compose"
		| "runtimeWorker"
		| "docklands-server";
}

export const ShowSchedules = ({ id, scheduleType = "application" }: Props) => {
	const [runningSchedules, setRunningSchedules] = useState<Set<string>>(
		new Set(),
	);
	const {
		data: schedules,
		isLoading: isLoadingSchedules,
		refetch: refetchSchedules,
	} = api.schedule.list.useQuery(
		{
			id: id || "",
			scheduleType,
		},
		{
			enabled: !!id,
		},
	);
	const utils = api.useUtils();
	const { mutateAsync: deleteSchedule, isPending: isDeleting } =
		api.schedule.delete.useMutation();
	const { mutateAsync: runManually } = api.schedule.runManually.useMutation();

	const handleRunManually = async (scheduleId: string) => {
		setRunningSchedules((prev) => new Set(prev).add(scheduleId));
		try {
			await runManually({ scheduleId });
			toast.success("Automation run successfully");
			await refetchSchedules();
		} catch (err) {
			logger.error("Failed to run automation", err);
			toast.error("Error running automation");
		} finally {
			setRunningSchedules((prev) => {
				const newSet = new Set(prev);
				newSet.delete(scheduleId);
				return newSet;
			});
		}
	};

	return (
		<SectionCard
			title="Automations"
			className="h-full min-h-[50vh]"
			actions={
				schedules && schedules.length > 0 ? (
					<HandleSchedules id={id} scheduleType={scheduleType} />
				) : null
			}
		>
			<div className="px-0">
				{isLoadingSchedules ? (
					<div className="flex gap-4 w-full items-center justify-center text-center mx-auto min-h-[45vh]">
						<Loader2 className="size-4 text-kumo-subtle/70 transition-colors animate-spin self-center" />
						<span className="text-sm text-kumo-subtle/70">
							Loading automations...
						</span>
					</div>
				) : schedules && schedules.length > 0 ? (
					<div className="grid xl:grid-cols-2 gap-4 grid-cols-1 h-full">
						{schedules.map((schedule) => {
							const runtimeWorkerId =
								schedule.runtimeWorkerId ||
								schedule.application?.runtimeWorkerId ||
								schedule.compose?.runtimeWorkerId;
							return (
								<div
									key={schedule.scheduleId}
									className="flex flex-col sm:flex-row sm:items-center flex-wrap sm:flex-nowrap gap-y-2 justify-between rounded-lg border p-3 transition-colors bg-kumo-fill/50 w-full"
								>
									<div className="flex items-start gap-3 w-full sm:w-auto">
										<div className="flex flex-shrink-0 h-9 w-9 items-center justify-center rounded-full bg-kumo-brand/5">
											<Clock className="size-4 text-kumo-brand/70" />
										</div>
										<div className="space-y-1.5 w-full sm:w-auto">
											<div className="flex items-center gap-2 flex-wrap">
												<h3 className="text-sm font-medium leading-none [overflow-wrap:anywhere] line-clamp-3">
													{schedule.name}
												</h3>
												<Badge
													variant={schedule.enabled ? "secondary" : "secondary"}
													className="text-[10px] px-1 py-0"
												>
													{schedule.enabled ? "Enabled" : "Disabled"}
												</Badge>
											</div>
											{schedule.description && (
												<p className="text-xs text-kumo-subtle/70 [overflow-wrap:anywhere] line-clamp-2">
													{schedule.description}
												</p>
											)}
											<div className="flex items-center gap-2 text-sm text-kumo-subtle flex-wrap">
												<Badge
													variant="outline"
													className="font-mono text-[10px] bg-transparent"
												>
													Cron: {schedule.cronExpression}
												</Badge>
												{schedule.scheduleType !== "runtimeWorker" &&
													schedule.scheduleType !== "docklands-server" && (
														<>
															<span className="text-xs text-kumo-subtle/50">
																•
															</span>
															<Badge
																variant="outline"
																className="font-mono text-[10px] bg-transparent"
															>
																{schedule.shellType}
															</Badge>
														</>
													)}
											</div>
											{schedule.command && (
												<div className="flex items-start gap-2 max-w-full">
													<Terminal className="size-3.5 text-kumo-subtle/70 flex-shrink-0 mt-0.5" />
													<code className="font-mono text-[10px] text-kumo-subtle/70 break-all max-w-[calc(100%-20px)]">
														{schedule.command}
													</code>
												</div>
											)}
										</div>
									</div>
									<div className="flex items-center gap-0.5 md:gap-1.5">
										<ShowDeploymentsModal
											id={schedule.scheduleId}
											type="schedule"
											runtimeWorkerId={runtimeWorkerId || undefined}
										>
											<Button
												aria-label="View automation build history"
												variant="ghost"
												shape="square"
											>
												<ClipboardList className="size-4 transition-colors" />
											</Button>
										</ShowDeploymentsModal>
										<TooltipProvider delay={0}>
											<Tooltip content={<>Run Automation Now</>} asChild>
												<Button
													aria-label="Run automation now"
													type="button"
													variant="ghost"
													shape="square"
													disabled={runningSchedules.has(schedule.scheduleId)}
													onClick={() => handleRunManually(schedule.scheduleId)}
												>
													{runningSchedules.has(schedule.scheduleId) ? (
														<Loader2 className="size-4 animate-spin" />
													) : (
														<Play className="size-4 transition-colors" />
													)}
												</Button>
											</Tooltip>
										</TooltipProvider>
										<HandleSchedules
											scheduleId={schedule.scheduleId}
											id={id}
											scheduleType={scheduleType}
										/>
										<DialogAction
											title="Delete Automation"
											description="Are you sure you want to delete this automation?"
											type="destructive"
											onClick={async () => {
												await deleteSchedule({
													scheduleId: schedule.scheduleId,
												})
													.then(() => {
														utils.schedule.list.invalidate({
															id,
															scheduleType,
														});
														toast.success("Automation deleted successfully");
													})
													.catch((err) => {
														logger.error("Failed to delete automation", err);
														toast.error("Error deleting automation");
													});
											}}
										>
											<Button
												aria-label="Delete automation"
												variant="ghost"
												shape="square"
												className="group hover:bg-kumo-danger/10"
												disabled={isDeleting}
											>
												<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
											</Button>
										</DialogAction>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col gap-2 items-center justify-center py-12 rounded-lg">
						<Clock className="size-8 mb-4 text-kumo-subtle" />
						<p className="text-lg font-medium text-kumo-subtle">
							No automations
						</p>
						<p className="text-sm text-kumo-subtle mt-1">
							Create your first automation to run recurring workflows
						</p>
						<HandleSchedules id={id} scheduleType={scheduleType} />
					</div>
				)}
			</div>
		</SectionCard>
	);
};
