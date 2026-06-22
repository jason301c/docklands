import { Button } from "@cloudflare/kumo/components/button";
import { Bell, Loader2, Mail, PenBoxIcon, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import {
	DiscordIcon,
	GotifyIcon,
	LarkIcon,
	MattermostIcon,
	NtfyIcon,
	ResendIcon,
	SlackIcon,
	TeamsIcon,
	TelegramIcon,
} from "@/components/icons/notification-icons";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { HandleNotifications } from "./handle-notifications";

export const ShowNotifications = () => {
	const { data, isPending, refetch } = api.notification.all.useQuery();
	const { mutateAsync, isPending: isRemoving } =
		api.notification.remove.useMutation();
	const { data: permissions } = api.user.getPermissions.useQuery();

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<Bell className="size-6 text-kumo-subtle self-center" />
						Notifications
					</h3>
					<p>
						Add your providers to receive notifications, like Discord, Slack,
						Telegram, Teams, Email, Resend, Lark.
					</p>
				</div>
				<div className="space-y-2 py-8 border-t">
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
										To send notifications it is required to set at least 1
										provider.
									</span>
									{permissions?.notification.create && <HandleNotifications />}
								</div>
							) : (
								<div className="flex flex-col gap-4 min-h-[25vh]">
									<div className="flex flex-col gap-4 rounded-lg ">
										{data?.map((notification, _index) => (
											<div
												key={notification.notificationId}
												className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
											>
												<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border  w-full">
													<span className="text-sm flex flex-row items-center gap-4">
														{notification.notificationType === "slack" && (
															<div className="flex  items-center justify-center rounded-lg">
																<SlackIcon className="size-6" />
															</div>
														)}
														{notification.notificationType === "telegram" && (
															<div className="flex  items-center justify-center rounded-lg ">
																<TelegramIcon className="size-7 " />
															</div>
														)}
														{notification.notificationType === "discord" && (
															<div className="flex  items-center justify-center rounded-lg">
																<DiscordIcon className="size-7 " />
															</div>
														)}
														{notification.notificationType === "email" && (
															<div className="flex  items-center justify-center rounded-lg ">
																<Mail className="size-6 text-kumo-subtle" />
															</div>
														)}
														{notification.notificationType === "resend" && (
															<div className="flex  items-center justify-center rounded-lg ">
																<ResendIcon className="size-6 text-kumo-subtle" />
															</div>
														)}
														{notification.notificationType === "gotify" && (
															<div className="flex  items-center justify-center rounded-lg ">
																<GotifyIcon className="size-6" />
															</div>
														)}
														{notification.notificationType === "ntfy" && (
															<div className="flex  items-center justify-center rounded-lg ">
																<NtfyIcon className="size-6" />
															</div>
														)}
														{notification.notificationType === "custom" && (
															<div className="flex  items-center justify-center rounded-lg ">
																<PenBoxIcon className="size-6 text-kumo-subtle" />
															</div>
														)}
														{notification.notificationType === "lark" && (
															<div className="flex  items-center justify-center rounded-lg">
																<LarkIcon className="size-7 text-kumo-subtle" />
															</div>
														)}
														{notification.notificationType === "teams" && (
															<div className="flex  items-center justify-center rounded-lg">
																<TeamsIcon className="size-7 text-kumo-subtle" />
															</div>
														)}
														{notification.notificationType === "mattermost" && (
															<div className="flex  items-center justify-center rounded-lg">
																<MattermostIcon className="size-7" />
															</div>
														)}

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
																		.catch(() => {
																			toast.error(
																				"Error deleting notification",
																			);
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
										))}
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
				</div>
			</div>
		</div>
	);
};
