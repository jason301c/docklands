import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import {
	CheckIcon,
	ChevronsUpDown,
	DatabaseZap,
	PenBoxIcon,
	PlusIcon,
	RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
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
import { ScrollArea } from "@/components/shared/scroll-area";
import { toast } from "@/components/shared/toast";
import { BACKUP_DATABASE_ENGINE_KEYS } from "@/shared/database-engines";
import { cn } from "@/shared/utils";
import { ScheduleFormField } from "../../application/schedules/handle-schedules";
import { ENGINE_LABELS } from "../general/engine-labels";
import {
	composeBackupMetadataEngineShape,
	refineComposeBackupMetadata,
} from "./backup-metadata";
import { ComposeCredentialFields } from "./compose-credential-fields";

const logger = createClientLogger("database-backup");

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/shared/command";

type CacheType = "cache" | "fetch";

type DatabaseType =
	| "postgres"
	| "mariadb"
	| "mysql"
	| "mongo"
	| "web-server"
	| "libsql";

const Schema = z
	.object({
		destinationId: z.string().min(1, "Destination required"),
		schedule: z.string().min(1, "Schedule (Cron) required"),
		prefix: z.string().min(1, "Prefix required"),
		enabled: z.boolean(),
		database: z.string().min(1, "Database required"),
		keepLatestCount: z.coerce.number().optional(),
		serviceName: z.string().nullable(),
		databaseType: z
			.enum(["postgres", "mariadb", "mysql", "mongo", "web-server", "libsql"])
			.optional(),
		backupType: z.enum(["database", "compose"]),
		metadata: z.object(composeBackupMetadataEngineShape).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.backupType === "compose" && !data.databaseType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Database type is required for compose backups",
				path: ["databaseType"],
			});
		}

		if (data.backupType === "compose" && !data.serviceName) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Service name is required for compose backups",
				path: ["serviceName"],
			});
		}

		if (data.backupType === "compose") {
			refineComposeBackupMetadata(data.databaseType, data.metadata, ctx);
		}
	});

interface Props {
	id?: string;
	backupId?: string;
	databaseType?: DatabaseType;
	refetch: () => void;
	backupType: "database" | "compose";
}

export const HandleBackup = ({
	id,
	backupId,
	databaseType = "postgres",
	refetch,
	backupType = "database",
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);

	const { data, isPending } = api.destination.all.useQuery();
	const { data: backup } = api.backup.one.useQuery(
		{
			backupId: backupId ?? "",
		},
		{
			enabled: !!backupId,
		},
	);
	const [cacheType, setCacheType] = useState<CacheType>("cache");
	const updateBackup = api.backup.update.useMutation();
	const createBackupMutation = api.backup.create.useMutation();
	const { mutateAsync: createBackup, isPending: isCreatingPostgresBackup } =
		backupId ? updateBackup : createBackupMutation;

	const form = useForm({
		defaultValues: {
			database:
				databaseType === "web-server"
					? "docklands"
					: databaseType === "libsql"
						? "iku.db"
						: "",
			destinationId: "",
			enabled: true,
			prefix: "/",
			schedule: "",
			keepLatestCount: undefined,
			serviceName: null,
			databaseType: backupType === "compose" ? undefined : databaseType,
			backupType: backupType,
			metadata: {},
		},
		resolver: zodResolver(Schema),
	});

	const {
		data: services,
		isFetching: isLoadingServices,
		error: errorServices,
		refetch: refetchServices,
	} = api.compose.loadServices.useQuery(
		{
			composeId: backup?.composeId ?? id ?? "",
			type: cacheType,
		},
		{
			retry: false,
			refetchOnWindowFocus: false,
			enabled: backupType === "compose" && !!backup?.composeId && !!id,
		},
	);

	useEffect(() => {
		form.reset({
			database: backup?.database
				? backup?.database
				: databaseType === "web-server"
					? "docklands"
					: databaseType === "libsql"
						? "iku.db"
						: "",
			destinationId: backup?.destinationId ?? "",
			enabled: backup?.enabled ?? true,
			prefix: backup?.prefix ?? "/",
			schedule: backup?.schedule ?? "",
			keepLatestCount: backup?.keepLatestCount ?? undefined,
			serviceName: backup?.serviceName ?? null,
			databaseType: backup?.databaseType ?? databaseType,
			backupType: backup?.backupType ?? backupType,
			metadata: backup?.metadata ?? {},
		});
	}, [form, form.reset, backupId, backup]);

	const onSubmit = async (data: z.infer<typeof Schema>) => {
		const getDatabaseId =
			backupType === "compose"
				? {
						composeId: id,
					}
				: databaseType === "web-server"
					? {
							userId: id,
						}
					: {
							databaseId: id,
						};

		await createBackup({
			destinationId: data.destinationId,
			prefix: data.prefix,
			schedule: data.schedule,
			enabled: data.enabled,
			database: data.database,
			keepLatestCount: data.keepLatestCount ?? null,
			databaseType: data.databaseType || databaseType,
			serviceName: data.serviceName,
			...getDatabaseId,
			backupId: backupId ?? "",
			backupType,
			metadata: data.metadata,
		})
			.then(async () => {
				toast.success(`Backup ${backupId ? "Updated" : "Created"}`);
				refetch();
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error("Error saving backup", err);
				toast.error(`Error ${backupId ? "updating" : "creating"} a backup`);
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					backupId ? (
						<Button
							aria-label="Edit database backup"
							variant="ghost"
							shape="square"
							className="group hover:bg-kumo-brand/10 size-8"
						>
							<PenBoxIcon className="size-3.5 text-kumo-brand group-hover:text-kumo-brand" />
						</Button>
					) : (
						((
							<Button>
								<PlusIcon className="h-4 w-4" />
								{backupId ? "Update Backup" : "Create Backup"}
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<div>
					<Dialog.Title>
						{backupId ? "Update Backup" : "Create Backup"}
					</Dialog.Title>
					<Dialog.Description>
						{backupId ? "Update a backup" : "Add a new backup"}
					</Dialog.Description>
				</div>

				<Form {...form}>
					<form
						id="hook-form-add-backup"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="grid grid-cols-1 gap-4">
							{errorServices && (
								<AlertBlock type="warning" className="[overflow-wrap:anywhere]">
									{errorServices?.message}
								</AlertBlock>
							)}
							{backupType === "compose" && (
								<FormField
									control={form.control}
									name="databaseType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Database Type</FormLabel>
											<Select
												aria-label="Database type"
												value={field.value}
												onValueChange={(value) => {
													if (value === null) return;
													field.onChange(value as DatabaseType);
													form.setValue("metadata", {});
												}}
											>
												<></>
												<>
													{BACKUP_DATABASE_ENGINE_KEYS.map((engine) => (
														<Select.Option key={engine} value={engine}>
															{ENGINE_LABELS[engine]}
														</Select.Option>
													))}
												</>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}
							<FormField
								control={form.control}
								name="destinationId"
								render={({ field }) => (
									<FormItem className="">
										<FormLabel>Destination</FormLabel>
										<Popover>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														variant="outline"
														className={cn(
															"w-full justify-between !bg-kumo-line",
															!field.value && "text-kumo-subtle",
														)}
													>
														{isPending
															? "Loading...."
															: field.value
																? data?.find(
																		(destination) =>
																			destination.destinationId === field.value,
																	)?.name
																: "Select Destination"}

														<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="p-0" align="start">
												<Command items={[]}>
													<CommandInput
														placeholder="Search Destination..."
														className="h-9"
													/>
													{isPending && (
														<span className="py-6 text-center text-sm">
															Loading Destinations....
														</span>
													)}
													<CommandEmpty>No destinations found.</CommandEmpty>
													<ScrollArea className="h-64">
														<CommandGroup>
															{data?.map((destination) => (
																<CommandItem
																	value={destination.destinationId}
																	key={destination.destinationId}
																	onSelect={() => {
																		form.setValue(
																			"destinationId",
																			destination.destinationId,
																		);
																	}}
																>
																	{destination.name}
																	<CheckIcon
																		className={cn(
																			"ml-auto h-4 w-4",
																			destination.destinationId === field.value
																				? "opacity-100"
																				: "opacity-0",
																		)}
																	/>
																</CommandItem>
															))}
														</CommandGroup>
													</ScrollArea>
												</Command>
											</PopoverContent>
										</Popover>

										<FormMessage />
									</FormItem>
								)}
							/>
							{backupType === "compose" && (
								<div className="flex flex-row items-end w-full gap-4">
									<FormField
										control={form.control}
										name="serviceName"
										render={({ field }) => (
											<FormItem className="w-full">
												<FormLabel>Service Name</FormLabel>
												<div className="flex gap-2">
													<Select
														aria-label="Database service"
														onValueChange={field.onChange}
														value={field.value || undefined}
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
															{(!services || services.length === 0) && (
																<Select.Option value="none" disabled>
																	Empty
																</Select.Option>
															)}
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
																<RefreshCw className="size-4 text-kumo-subtle" />
															</Button>
														</Tooltip>
													</TooltipProvider>
													<TooltipProvider delay={0}>
														<Tooltip
															content={
																<>
																	<p>
																		Cache: If you previously built this compose,
																		it will read the services from the last
																		build or repository fetch
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
																<DatabaseZap className="size-4 text-kumo-subtle" />
															</Button>
														</Tooltip>
													</TooltipProvider>
												</div>

												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							)}
							<FormField
								control={form.control}
								name="database"
								render={({ field }) => {
									return (
										<FormItem>
											<FormLabel>Database</FormLabel>
											<FormControl>
												<Input
													disabled={
														databaseType === "web-server" ||
														databaseType === "libsql"
													}
													placeholder={"docklands"}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									);
								}}
							/>

							<ScheduleFormField name="schedule" formControl={form.control} />

							<FormField
								control={form.control}
								name="prefix"
								render={({ field }) => {
									return (
										<FormItem>
											<FormLabel>Prefix Destination</FormLabel>
											<FormControl>
												<Input placeholder={"docklands/"} {...field} />
											</FormControl>
											<FormDescription>
												Use if you want to back up in a specific path of your
												destination/bucket
											</FormDescription>

											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<FormField
								control={form.control}
								name="keepLatestCount"
								render={({ field }) => {
									return (
										<FormItem>
											<FormLabel>Keep the latest</FormLabel>
											<FormControl>
												<Input
													type="number"
													placeholder={"keeps all the backups if left empty"}
													{...field}
													value={field.value as string}
												/>
											</FormControl>
											<FormDescription>
												Optional. If provided, only keeps the latest N backups
												in the cloud.
											</FormDescription>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<FormField
								control={form.control}
								name="enabled"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 ">
										<div className="space-y-0.5">
											<FormLabel>Enabled</FormLabel>
											<FormDescription>
												Enable or disable the backup
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
							{backupType === "compose" && (
								<ComposeCredentialFields
									databaseType={form.watch("databaseType")}
									control={form.control}
									placeholder={(engine, field) =>
										field.isPassword ? "••••••••" : engine
									}
								/>
							)}
						</div>
						<div>
							<Button
								loading={isCreatingPostgresBackup}
								form="hook-form-add-backup"
								type="submit"
							>
								{backupId ? "Update" : "Create"}
							</Button>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
