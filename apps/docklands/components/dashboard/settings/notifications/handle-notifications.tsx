import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertTriangle, PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "@/client/api/trpc";
import { Dialog } from "@/components/shared/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { cn } from "@/shared/utils";
import { buildResetValues } from "./notification-reset";
import {
	type NotificationSchema,
	notificationSchema,
} from "./notification-schema";
import { notificationsMap } from "./notifications-map";
import { ProviderFields } from "./provider-fields";
import { SwitchField, TextField } from "./provider-fields/fields";
import { useNotificationMutations } from "./use-notification-mutations";

interface Props {
	notificationId?: string;
}

/** The action toggles rendered for every provider (parent `notifications` row). */
const ACTION_FIELDS = [
	{
		name: "appDeploy",
		label: "App Build",
		description: "Trigger the action when an app build completes.",
	},
	{
		name: "appBuildError",
		label: "App Build Error",
		description: "Trigger the action when the build fails.",
	},
	{
		name: "databaseBackup",
		label: "Database Backup",
		description: "Trigger the action when a database backup is created.",
	},
	{
		name: "docklandsBackup",
		label: "Docklands Backup",
		description: "Trigger the action when a Docklands backup is created.",
	},
	{
		name: "volumeBackup",
		label: "Volume Backup",
		description: "Trigger the action when a volume backup is created.",
	},
	{
		name: "dockerCleanup",
		label: "Runtime Cleanup",
		description: "Trigger the action when runtime cleanup is performed.",
	},
	{
		name: "docklandsRestart",
		label: "Docklands Restart",
		description: "Trigger the action when Docklands is restarted.",
	},
] as const;

export const HandleNotifications = ({ notificationId }: Props) => {
	const [visible, setVisible] = useState(false);

	const { data: notification } = api.notification.one.useQuery(
		{ notificationId: notificationId || "" },
		{ enabled: !!notificationId },
	);

	const form = useForm({
		defaultValues: {
			type: "slack",
			webhookUrl: "",
			channel: "",
			name: "",
		},
		resolver: zodResolver(notificationSchema),
	});
	const type = form.watch("type");

	const { submitDispatch, testDispatch, activeMutation, isTesting } =
		useNotificationMutations({
			notificationId,
			notification,
			onSaved: () => {
				form.reset({ type: "slack", webhookUrl: "" });
				setVisible(false);
			},
		});

	useEffect(() => {
		if (notification) {
			form.reset(buildResetValues(notification));
		} else {
			form.reset();
		}
	}, [form, notification]);

	const onSubmit = async (data: NotificationSchema) => {
		if (
			data.type === "pushover" &&
			data.priority === 2 &&
			(data.retry == null || data.expire == null)
		) {
			toast.error("Retry and expire are required for emergency priority (2)");
			return;
		}
		// crudMutationOptions owns the toast/invalidate/onSaved (success) and the
		// toast/log (error) on the mutation; swallow the rejection here so
		// react-hook-form sees a settled submit and resets `isSubmitting`.
		try {
			await submitDispatch[data.type](data);
		} catch {
			// already surfaced by crudMutationOptions.onError
		}
	};

	const onTest = async () => {
		const isValid = await form.trigger();
		if (!isValid) return;
		const data = form.getValues() as NotificationSchema;
		try {
			await testDispatch[data.type](data);
			toast.success("Connection Success");
		} catch (error) {
			toast.error(
				`Error testing the provider: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	return (
		<Dialog.Root open={visible} onOpenChange={setVisible}>
			<Dialog.Trigger
				className=""
				render={
					notificationId ? (
						<Button
							aria-label="Edit notification"
							variant="ghost"
							shape="square"
							className="group hover:bg-kumo-brand/10 "
						>
							<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
						</Button>
					) : (
						((
							<Button variant="primary" className="cursor-pointer space-x-3">
								<PlusIcon className="h-4 w-4" />
								Add Notification
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-3xl">
				<Dialog.Header>
					<Dialog.Title>
						{notificationId ? "Update" : "Add"} Notification
					</Dialog.Title>
					<Dialog.Description>
						{notificationId
							? "Update your notification providers for multiple channels."
							: "Create new notification providers for multiple channels."}
					</Dialog.Description>
				</Dialog.Header>
				<Form {...form}>
					<form
						id="hook-form"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-8 "
					>
						<FormField
							control={form.control}
							defaultValue={form.control._defaultValues.type}
							name="type"
							render={({ field }) => (
								<FormItem className="space-y-3">
									<FormLabel className="text-lg font-semibold leading-none tracking-tight">
										Choose a platform
									</FormLabel>
									<FormControl>
										<div
											role="radiogroup"
											aria-label="Choose a platform"
											className="grid grid-cols-3 gap-2 sm:grid-cols-4"
										>
											{Object.entries(notificationsMap).map(
												([key, { Icon, label, selectorIconClassName }]) => {
													const selected = field.value === key;
													return (
														<label
															key={key}
															className={cn(
																"flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-kumo-brand",
																selected
																	? "border-kumo-brand bg-kumo-brand/5 ring-1 ring-kumo-brand"
																	: "border-kumo-hairline bg-kumo-base hover:border-kumo-line hover:bg-kumo-tint",
															)}
														>
															<input
																type="radio"
																name="notification-platform"
																value={key}
																checked={selected}
																onChange={() => field.onChange(key)}
																className="sr-only"
															/>
															<Icon className={selectorIconClassName} />
															<span
																className={cn(
																	"line-clamp-1",
																	selected
																		? "font-medium text-kumo-strong"
																		: "text-kumo-default",
																)}
															>
																{label}
															</span>
														</label>
													);
												},
											)}
										</div>
									</FormControl>
									<FormMessage />
									{activeMutation[field.value].isError && (
										<div className="flex flex-row gap-4 rounded-lg bg-kumo-danger-tint p-2">
											<AlertTriangle className="text-kumo-danger" />
											<span className="text-sm text-kumo-danger">
												{activeMutation[field.value].error?.message}
											</span>
										</div>
									)}
								</FormItem>
							)}
						/>

						<div className="flex flex-col gap-4">
							<FormLabel className="text-lg font-semibold leading-none tracking-tight">
								Configure the connection
							</FormLabel>
							<LayerCard className="flex flex-col gap-2 p-4">
								<TextField
									control={form.control}
									name="name"
									label="Name"
									placeholder="Name"
								/>

								<ProviderFields
									type={type}
									control={form.control}
									form={form}
								/>
							</LayerCard>
						</div>
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-1">
								<FormLabel className="text-lg font-semibold leading-none tracking-tight">
									Choose the events
								</FormLabel>
								<FormDescription>
									Select which events trigger a notification on this provider.
								</FormDescription>
							</div>

							<div className="grid md:grid-cols-2 gap-4">
								{ACTION_FIELDS.map((action) => (
									<SwitchField
										key={action.name}
										control={form.control}
										name={action.name}
										label={action.label}
										description={action.description}
									/>
								))}
							</div>
						</div>
					</form>

					<Dialog.Footer className="w-full !justify-end gap-3">
						<Button
							loading={isTesting}
							variant="secondary"
							type="button"
							onClick={onTest}
						>
							Test Notification
						</Button>
						<Button
							loading={form.formState.isSubmitting}
							variant="primary"
							form="hook-form"
							type="submit"
						>
							{notificationId ? "Update" : "Create"}
						</Button>
					</Dialog.Footer>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
