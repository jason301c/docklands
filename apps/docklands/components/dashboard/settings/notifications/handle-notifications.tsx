import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Switch } from "@cloudflare/kumo/components/switch";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertTriangle, PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { buildResetValues } from "./notification-reset";
import {
	type NotificationSchema,
	notificationSchema,
} from "./notification-schema";
import { notificationsMap } from "./notifications-map";
import {
	CustomFields,
	DiscordFields,
	EmailFields,
	GotifyFields,
	LarkFields,
	MattermostFields,
	NtfyFields,
	PushoverFields,
	ResendFields,
	SlackFields,
	TeamsFields,
	TelegramFields,
} from "./provider-fields";
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

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "toAddresses" as never,
	});

	const {
		fields: headerFields,
		append: appendHeader,
		remove: removeHeader,
	} = useFieldArray({
		control: form.control,
		name: "headers" as never,
	});

	useEffect(() => {
		if ((type === "email" || type === "resend") && fields.length === 0) {
			append("");
		}
	}, [type, append, fields.length]);

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
							<Button className="cursor-pointer space-x-3">
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
									<FormLabel className="text-kumo-subtle">
										Select a provider
									</FormLabel>
									<FormControl>
										<Radio.Group
											onValueChange={field.onChange}
											defaultValue={field.value}
											orientation="horizontal"
											appearance="card"
											className="w-full"
										>
											<Radio.Legend className="sr-only">
												Select a provider
											</Radio.Legend>
											{Object.entries(notificationsMap).map(
												([key, { Icon, label, selectorIconClassName }]) => (
													<Radio.Item
														key={key}
														value={key}
														className="min-h-24"
														label={
															<span className="flex flex-col items-center gap-2 text-center">
																<Icon className={selectorIconClassName} />
																<span>{label}</span>
															</span>
														}
													/>
												),
											)}
										</Radio.Group>
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
								Fill the next fields.
							</FormLabel>
							<div className="flex flex-col gap-2">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input placeholder="Name" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{type === "slack" && <SlackFields control={form.control} />}
								{type === "telegram" && (
									<TelegramFields control={form.control} />
								)}
								{type === "discord" && <DiscordFields control={form.control} />}
								{type === "email" && (
									<EmailFields
										control={form.control}
										form={form}
										type={type}
										fields={fields}
										append={append}
										remove={remove}
									/>
								)}
								{type === "resend" && (
									<ResendFields
										control={form.control}
										form={form}
										type={type}
										fields={fields}
										append={append}
										remove={remove}
									/>
								)}
								{type === "gotify" && <GotifyFields control={form.control} />}
								{type === "ntfy" && <NtfyFields control={form.control} />}
								{type === "mattermost" && (
									<MattermostFields control={form.control} />
								)}
								{type === "custom" && (
									<CustomFields
										control={form.control}
										headerFields={headerFields}
										appendHeader={appendHeader}
										removeHeader={removeHeader}
									/>
								)}
								{type === "lark" && <LarkFields control={form.control} />}
								{type === "teams" && <TeamsFields control={form.control} />}
								{type === "pushover" && (
									<PushoverFields
										control={form.control}
										priority={form.watch("priority")}
									/>
								)}
							</div>
						</div>
						<div className="flex flex-col gap-4">
							<FormLabel className="text-lg font-semibold leading-none tracking-tight">
								Select the actions.
							</FormLabel>

							<div className="grid md:grid-cols-2 gap-4">
								{ACTION_FIELDS.map((action) => (
									<FormField
										key={action.name}
										control={form.control}
										name={action.name}
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
												<div className="space-y-0.5">
													<FormLabel>{action.label}</FormLabel>
													<FormDescription>
														{action.description}
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
													/>
												</FormControl>
											</FormItem>
										)}
									/>
								))}
							</div>
						</div>
					</form>

					<Dialog.Footer className="!justify-between w-full">
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
