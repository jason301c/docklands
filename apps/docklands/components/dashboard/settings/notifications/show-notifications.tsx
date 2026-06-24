"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Bell, Loader2, PenBoxIcon, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { toast } from "@/components/shared/toast";
import { HandleNotifications } from "./handle-notifications";
import { notificationsMap } from "./notifications-map";

const logger = createClientLogger("notifications");

export const ShowNotifications = () => {
	const { data, isPending, refetch } = api.notification.all.useQuery();
	const { mutateAsync, isPending: isRemoving } =
		api.notification.remove.useMutation();
	const { permissions } = usePermissions();

	return (
		<SectionCard title="Notifications">
			{isPending ? (
				<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[25vh]">
					<span>Loading...</span>
					<Loader2 className="animate-spin size-4" />
				</div>
			) : (
				<>
					{data?.length === 0 ? (
						<div className="flex flex-col items-center gap-3  min-h-[25vh] justify-center">
							<Bell />
							<span className="text-base text-kumo-subtle text-center">
								To send notifications it is required to set at least 1 provider.
							</span>
							{permissions?.notification.create && <HandleNotifications />}
						</div>
					) : (
						<div className="flex flex-col gap-4 min-h-[25vh]">
							<div className="flex flex-col gap-4 rounded-lg ">
								{data?.map((notification, _index) => {
									const provider =
										notificationsMap[notification.notificationType];
									const Icon = provider?.Icon ?? PenBoxIcon;
									return (
										<div
											key={notification.notificationId}
											className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
										>
											<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border  w-full">
												<span className="text-sm flex flex-row items-center gap-4">
													<div className="flex items-center justify-center rounded-lg">
														<Icon className={provider?.listIconClassName} />
													</div>

													{notification.name}
												</span>
												<div className="flex flex-row gap-1">
													<HandleNotifications
														notificationId={notification.notificationId}
													/>

													{permissions?.notification.delete && (
														<DialogAction
															title="Delete Notification"
															description="Are you sure you want to delete this notification?"
															type="destructive"
															onClick={async () => {
																await mutateAsync({
																	notificationId: notification.notificationId,
																})
																	.then(() => {
																		toast.success(
																			"Notification deleted successfully",
																		);
																		refetch();
																	})
																	.catch((err) => {
																		logger.error(err);
																		toast.error("Error deleting notification");
																	});
															}}
														>
															<Button
																aria-label="Delete notification"
																variant="ghost"
																shape="square"
																className="group hover:bg-kumo-danger/10 "
																loading={isRemoving}
															>
																<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
															</Button>
														</DialogAction>
													)}
												</div>
											</div>
										</div>
									);
								})}
							</div>

							{permissions?.notification.create && (
								<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
									<HandleNotifications />
								</div>
							)}
						</div>
					)}
				</>
			)}
		</SectionCard>
	);
};
