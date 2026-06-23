import { Button } from "@cloudflare/kumo/components/button";
import { Combobox } from "@cloudflare/kumo/components/combobox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { Switch } from "@cloudflare/kumo/components/switch";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { CheckIcon, ChevronsUpDown, PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
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
import { cn } from "@/shared/utils";
import { ScheduleFormField } from "../../application/schedules/handle-schedules";

const logger = createClientLogger("compose");

/**
 * Backup engines that support logical backups. Mirrors the managed-database
 * backup engines; redis/libsql are excluded (no logical-dump support).
 */
type ServiceDatabaseEngine = "postgres" | "mariadb" | "mysql" | "mongo";

const Schema = z.object({
	destinationId: z.string().min(1, "Destination required"),
	schedule: z.string().min(1, "Schedule (Cron) required"),
	prefix: z.string().min(1, "Prefix required"),
	enabled: z.boolean(),
	database: z.string().min(1, "Database required"),
	keepLatestCount: z.coerce.number().optional(),
});

interface Props {
	serviceDatabaseId: string;
	engine: ServiceDatabaseEngine;
	serviceName: string;
	backupId?: string;
	refetch: () => void;
}

export const HandleServiceDatabaseBackup = ({
	serviceDatabaseId,
	engine,
	serviceName,
	backupId,
	refetch,
}: Props) => {
	const utils = api.useUtils();
	const { data: destinations, isPending } = api.destination.all.useQuery();
	const { data: backup } = api.backup.one.useQuery(
		{ backupId: backupId ?? "" },
		{ enabled: !!backupId },
	);

	const { mutateAsync: createBackup, isPending: isCreating } = backupId
		? api.backup.update.useMutation()
		: api.backup.create.useMutation();

	const form = useForm({
		defaultValues: {
			database: "",
			destinationId: "",
			enabled: true,
			prefix: "/",
			schedule: "",
			keepLatestCount: undefined,
		},
		resolver: zodResolver(Schema),
	});

	useEffect(() => {
		form.reset({
			database: backup?.database ?? "",
			destinationId: backup?.destinationId ?? "",
			enabled: backup?.enabled ?? true,
			prefix: backup?.prefix ?? "/",
			schedule: backup?.schedule ?? "",
			keepLatestCount: backup?.keepLatestCount ?? undefined,
		});
	}, [form, backup]);

	const onSubmit = async (data: z.infer<typeof Schema>) => {
		await createBackup({
			destinationId: data.destinationId,
			prefix: data.prefix,
			schedule: data.schedule,
			enabled: data.enabled,
			database: data.database,
			keepLatestCount: data.keepLatestCount ?? null,
			databaseType: engine,
			serviceName,
			serviceDatabaseId,
			backupId: backupId ?? "",
			backupType: "database",
			metadata: backup?.metadata ?? null,
		})
			.then(async () => {
				toast.success(`Backup ${backupId ? "Updated" : "Created"}`);
				await utils.serviceDatabase.backups.invalidate({ serviceDatabaseId });
				refetch();
			})
			.catch((err) => {
				logger.error(
					`Failed to ${backupId ? "update" : "create"} a backup`,
					err,
				);
				toast.error(`Error ${backupId ? "updating" : "creating"} a backup`);
			});
	};

	return (
		<Dialog.Root>
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
								Create Backup
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
						{backupId ? "Update a backup" : "Add a new backup"} for{" "}
						<span className="font-medium">{serviceName}</span>
					</Dialog.Description>
				</div>

				<Form {...form}>
					<form
						id="hook-form-add-service-database-backup"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="grid grid-cols-1 gap-4">
							<FormField
								control={form.control}
								name="destinationId"
								render={({ field }) => (
									<FormItem>
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
																? destinations?.find(
																		(destination) =>
																			destination.destinationId === field.value,
																	)?.name
																: "Select Destination"}

														<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="p-0" align="start">
												<Combobox items={[]}>
													<Combobox.TriggerInput
														placeholder="Search Destination..."
														className="h-9"
													/>
													{isPending && (
														<span className="py-6 text-center text-sm">
															Loading Destinations....
														</span>
													)}
													<Combobox.Empty>
														No destinations found.
													</Combobox.Empty>
													<ScrollArea className="h-64">
														<Combobox.Group>
															{destinations?.map((destination) => (
																<Combobox.Item
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
																</Combobox.Item>
															))}
														</Combobox.Group>
													</ScrollArea>
												</Combobox>
											</PopoverContent>
										</Popover>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="database"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Database</FormLabel>
										<FormControl>
											<Input placeholder="docklands" {...field} />
										</FormControl>
										<FormDescription>
											Name of the database inside the {engine} container to back
											up.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<ScheduleFormField name="schedule" formControl={form.control} />

							<FormField
								control={form.control}
								name="prefix"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Prefix Destination</FormLabel>
										<FormControl>
											<Input placeholder="docklands/" {...field} />
										</FormControl>
										<FormDescription>
											Use if you want to back up in a specific path of your
											destination/bucket
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
										<FormLabel>Keep the latest</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="keeps all the backups if left empty"
												{...field}
												value={field.value as string}
											/>
										</FormControl>
										<FormDescription>
											Optional. If provided, only keeps the latest N backups in
											the cloud.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="enabled"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
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
						</div>
						<div>
							<Button
								loading={isCreating}
								form="hook-form-add-service-database-backup"
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
