import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { DatabaseZap, PenBoxIcon, PlusCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
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
import type { CacheType } from "../domains/handle-domain";
import { ScheduleFormField } from "../schedules/handle-schedules";

const formSchema = z
	.object({
		name: z.string().min(1, "Name is required"),
		cronExpression: z.string().min(1, "Cron expression is required"),
		volumeName: z
			.string()
			.min(1, "Volume name is required")
			.regex(
				/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
				"Invalid volume name. Use letters, numbers, '._-' and start with a letter/number.",
			),
		prefix: z.string(),
		keepLatestCount: z.coerce
			.number()
			.int()
			.gte(1, "Must be at least 1")
			.optional()
			.nullable(),
		turnOff: z.boolean().default(false),
		enabled: z.boolean().default(true),
		serviceType: z.enum([
			"application",
			"compose",
			"postgres",
			"mariadb",
			"mongo",
			"mysql",
			"redis",
			"libsql",
		]),
		serviceName: z.string(),
		destinationId: z.string().min(1, "Destination required"),
	})
	.superRefine((data, ctx) => {
		if (data.serviceType === "compose" && !data.serviceName) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Service name is required",
				path: ["serviceName"],
			});
		}

		if (data.serviceType === "compose" && !data.serviceName) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Service name is required",
				path: ["serviceName"],
			});
		}
	});

interface Props {
	id?: string;
	volumeBackupId?: string;
	volumeBackupType?:
		| "application"
		| "compose"
		| "postgres"
		| "mariadb"
		| "mongo"
		| "mysql"
		| "redis";
}

export const HandleVolumeBackups = ({
	id,
	volumeBackupId,
	volumeBackupType,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [cacheType, setCacheType] = useState<CacheType>("cache");
	const [keepLatestCountInput, setKeepLatestCountInput] = useState("");

	const utils = api.useUtils();
	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			cronExpression: "",
			volumeName: "",
			prefix: "",
			keepLatestCount: undefined,
			turnOff: false,
			enabled: true,
			serviceName: "",
			serviceType: volumeBackupType,
		},
	});

	const serviceTypeForm = volumeBackupType;
	const { data: destinations } = api.destination.all.useQuery();
	const { data: volumeBackup } = api.volumeBackups.one.useQuery(
		{ volumeBackupId: volumeBackupId || "" },
		{ enabled: !!volumeBackupId },
	);

	const { data: mounts } = api.mounts.allNamedByApplicationId.useQuery(
		{ applicationId: id || "" },
		{ enabled: !!id && volumeBackupType === "application" },
	);

	const {
		data: services,
		isFetching: isLoadingServices,
		error: errorServices,
		refetch: refetchServices,
	} = api.compose.loadServices.useQuery(
		{
			composeId: id || "",
			type: cacheType,
		},
		{
			retry: false,
			refetchOnWindowFocus: false,
			enabled: !!id && volumeBackupType === "compose",
		},
	);

	const serviceName = form.watch("serviceName");

	const { data: mountsByService } = api.compose.loadMountsByService.useQuery(
		{
			composeId: id || "",
			serviceName,
		},
		{
			enabled: !!id && volumeBackupType === "compose" && !!serviceName,
		},
	);

	useEffect(() => {
		if (volumeBackupId && volumeBackup) {
			form.reset({
				name: volumeBackup.name,
				cronExpression: volumeBackup.cronExpression,
				volumeName: volumeBackup.volumeName || "",
				prefix: volumeBackup.prefix,
				keepLatestCount: volumeBackup.keepLatestCount || undefined,
				turnOff: volumeBackup.turnOff,
				enabled: volumeBackup.enabled || false,
				serviceName: volumeBackup.serviceName || "",
				destinationId: volumeBackup.destinationId,
				serviceType: volumeBackup.serviceType,
			});
			setKeepLatestCountInput(
				volumeBackup.keepLatestCount !== null &&
					volumeBackup.keepLatestCount !== undefined
					? String(volumeBackup.keepLatestCount)
					: "",
			);
		}
	}, [form, volumeBackup, volumeBackupId]);

	const { mutateAsync, isPending } = volumeBackupId
		? api.volumeBackups.update.useMutation()
		: api.volumeBackups.create.useMutation();

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		if (!id && !volumeBackupId) return;

		const preparedKeepLatestCount =
			keepLatestCountInput === "" ? null : (values.keepLatestCount ?? null);

		await mutateAsync({
			...values,
			keepLatestCount: preparedKeepLatestCount ?? undefined,
			destinationId: values.destinationId,
			volumeBackupId: volumeBackupId || "",
			serviceType: volumeBackupType,
			...(volumeBackupType === "application" && {
				applicationId: id || "",
			}),
			...(volumeBackupType === "compose" && {
				composeId: id || "",
			}),
			...(volumeBackupType === "postgres" && {
				serverId: id || "",
			}),
			...(volumeBackupType === "postgres" && {
				postgresId: id || "",
			}),
			...(volumeBackupType === "mariadb" && {
				mariadbId: id || "",
			}),
			...(volumeBackupType === "mongo" && {
				mongoId: id || "",
			}),
			...(volumeBackupType === "mysql" && {
				mysqlId: id || "",
			}),
			...(volumeBackupType === "redis" && {
				redisId: id || "",
			}),
		})
			.then(() => {
				toast.success(
					`Volume backup ${volumeBackupId ? "updated" : "created"} successfully`,
				);
				utils.volumeBackups.list.invalidate({
					id,
					volumeBackupType,
				});
				setIsOpen(false);
			})
			.catch((error) => {
				toast.error(
					error instanceof Error ? error.message : "An unknown error occurred",
				);
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					volumeBackupId ? (
						<Button
							aria-label="Edit volume backup"
							variant="ghost"
							shape="square"
							className="group hover:bg-blue-500/10"
						>
							<PenBoxIcon className="size-3.5 text-primary group-hover:text-blue-500" />
						</Button>
					) : (
						((
							<Button>
								<PlusCircle className="w-4 h-4 mr-2" />
								Add Volume Backup
							</Button>
						) as never)
					)
				}
			/>
			<Dialog
				className={cn(
					volumeBackupType === "compose" || volumeBackupType === "application"
						? "sm:max-w-2xl"
						: " sm:max-w-lg",
				)}
			>
				<div>
					<Dialog.Title>
						{volumeBackupId ? "Edit" : "Create"} Volume Backup
					</Dialog.Title>
					<Dialog.Description>
						Create a volume backup to backup your volume to a destination
					</Dialog.Description>
				</div>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="flex items-center gap-2">
										Task Name
									</FormLabel>
									<FormControl>
										<Input placeholder="Daily Database Backup" {...field} />
									</FormControl>
									<FormDescription>
										A descriptive name for your scheduled task
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<ScheduleFormField
							name="cronExpression"
							formControl={form.control}
						/>

						<FormField
							control={form.control}
							name="destinationId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Destination</FormLabel>
									<Select
										aria-label="Volume backup destination"
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<></>
										</FormControl>
										<>
											{destinations?.map((destination) => (
												<Select.Option
													key={destination.destinationId}
													value={destination.destinationId}
												>
													{destination.name}
												</Select.Option>
											))}
										</>
									</Select>
									<FormDescription>
										Choose the backup destination where files will be stored
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						{serviceTypeForm === "compose" && (
							<>
								<div className="flex flex-col w-full gap-4">
									{errorServices && (
										<AlertBlock
											type="warning"
											className="[overflow-wrap:anywhere]"
										>
											{errorServices?.message}
										</AlertBlock>
									)}
									<FormField
										control={form.control}
										name="serviceName"
										render={({ field }) => (
											<FormItem className="w-full">
												<FormLabel>Service Name</FormLabel>
												<div className="flex gap-2">
													<Select
														aria-label="Volume backup service"
														onValueChange={field.onChange}
														defaultValue={field.value || ""}
													>
														<FormControl>
															<></>
														</FormControl>

														<>
															{services?.map((service, index) => (
																<Select.Option
																	value={service}
																	key={`${service}-${index}`}
																>
																	{service}
																</Select.Option>
															))}
															<Select.Option value="none" disabled>
																Empty
															</Select.Option>
														</>
													</Select>
													<TooltipProvider delay={0}>
														<Tooltip
															content={
																<>
																	<p>
																		Fetch: Will clone the repository and load
																		the services
																	</p>
																</>
															}
															side="left"
															className="max-w-[10rem]"
															asChild
														>
															<Button
																variant="secondary"
																type="button"
																loading={isLoadingServices}
																onClick={() => {
																	if (cacheType === "fetch") {
																		refetchServices();
																	} else {
																		setCacheType("fetch");
																	}
																}}
															>
																<RefreshCw className="size-4 text-muted-foreground" />
															</Button>
														</Tooltip>
													</TooltipProvider>
													<TooltipProvider delay={0}>
														<Tooltip
															content={
																<>
																	<p>
																		Cache: If you previously deployed this
																		compose, it will read the services from the
																		last build or repository fetch
																	</p>
																</>
															}
															side="left"
															className="max-w-[10rem]"
															asChild
														>
															<Button
																variant="secondary"
																type="button"
																loading={isLoadingServices}
																onClick={() => {
																	if (cacheType === "cache") {
																		refetchServices();
																	} else {
																		setCacheType("cache");
																	}
																}}
															>
																<DatabaseZap className="size-4 text-muted-foreground" />
															</Button>
														</Tooltip>
													</TooltipProvider>
												</div>

												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								{mountsByService && mountsByService.length > 0 && (
									<FormField
										control={form.control}
										name="volumeName"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Volumes</FormLabel>
												<Select
													aria-label="Volume to back up"
													onValueChange={field.onChange}
													defaultValue={field.value || ""}
												>
													<FormControl>
														<></>
													</FormControl>
													<>
														{mountsByService?.map((volume) => (
															<Select.Option
																key={volume.Name}
																value={volume.Name || ""}
															>
																{volume.Name}
															</Select.Option>
														))}
													</>
												</Select>
												<FormDescription>
													Choose the volume to backup. If you do not see the
													volume here, you can type the volume name manually
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
							</>
						)}
						{serviceTypeForm === "application" && (
							<FormField
								control={form.control}
								name="volumeName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Volumes</FormLabel>
										<Select
											aria-label="Volume to restore"
											onValueChange={field.onChange}
											defaultValue={field.value || ""}
										>
											<FormControl>
												<></>
											</FormControl>
											<>
												{mounts?.map((mount) => (
													<Select.Option
														key={mount.Name}
														value={mount.Name || ""}
													>
														{mount.Name}
													</Select.Option>
												))}
											</>
										</Select>
										<FormDescription>
											Choose the volume to backup. If you do not see the volume
											here, you can type the volume name manually
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<FormField
							control={form.control}
							name="volumeName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Volume Name</FormLabel>
									<FormControl>
										<Input placeholder="my-volume-name" {...field} />
									</FormControl>
									<FormDescription>
										The name of the Docker volume to backup
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="prefix"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Backup Prefix</FormLabel>
									<FormControl>
										<Input placeholder="backup-" {...field} />
									</FormControl>
									<FormDescription>
										Prefix for backup files (optional)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="keepLatestCount"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Keep Latest Backups</FormLabel>
									<FormControl>
										<Input
											{...field}
											type="number"
											min={1}
											autoComplete="off"
											placeholder="Leave empty to keep all"
											value={keepLatestCountInput}
											onChange={(e) => {
												const raw = e.target.value;
												setKeepLatestCountInput(raw);
												if (raw === "") {
													field.onChange(undefined);
												} else if (/^\d+$/.test(raw)) {
													field.onChange(Number(raw));
												}
											}}
										/>
									</FormControl>
									<FormDescription>
										How many recent backups to keep. Empty means no cleanup.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="turnOff"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="flex items-center gap-2">
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
										Turn Off Container During Backup
									</FormLabel>
									<FormDescription className="text-amber-600 dark:text-amber-400">
										⚠️ The container will be temporarily stopped during backup to
										prevent file corruption. This ensures data integrity but may
										cause temporary service interruption.
									</FormDescription>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="enabled"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="flex items-center gap-2">
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
										Enabled
									</FormLabel>
								</FormItem>
							)}
						/>

						<Button type="submit" loading={isPending} className="w-full">
							{volumeBackupId ? "Update" : "Create"} Volume Backup
						</Button>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
