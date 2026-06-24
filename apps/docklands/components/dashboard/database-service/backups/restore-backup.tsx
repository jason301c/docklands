import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { Select } from "@cloudflare/kumo/components/select";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import copy from "copy-to-clipboard";
import debounce from "lodash/debounce";
import { CheckIcon, ChevronsUpDown, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { DrawerLogs } from "@/components/shared/drawer-logs";

const logger = createClientLogger("database-backup");

import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/shared/command";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { type LogLine, parseLogs } from "@/components/shared/logs/utils";
import { ScrollArea } from "@/components/shared/scroll-area";
import { toast } from "@/components/shared/toast";
import { BACKUP_DATABASE_ENGINE_KEYS } from "@/shared/database-engines";
import { formatBytes } from "@/shared/format-bytes";
import { cn } from "@/shared/utils";
import type { ServiceType } from "../../application/advanced/show-resources";
import {
	ComposeServicePicker,
	useComposeServices,
} from "../../shared/compose-service-picker";
import { DestinationPicker } from "../../shared/destination-picker";
import { ENGINE_LABELS } from "../general/engine-labels";
import {
	composeBackupMetadataEngineShape,
	refineComposeBackupMetadata,
} from "./backup-metadata";
import { ComposeCredentialFields } from "./compose-credential-fields";

type DatabaseType =
	| Exclude<ServiceType, "application" | "redis">
	| "web-server";

interface Props {
	id: string;
	databaseType?: DatabaseType;
	runtimeWorkerId?: string | null;
	backupType?: "database" | "compose";
}

const RestoreBackupSchema = z
	.object({
		destinationId: z.string().min(1, {
			message: "Destination is required",
		}),
		backupFile: z.string().min(1, {
			message: "Backup file is required",
		}),
		databaseName: z.string().min(1, {
			message: "Database name is required",
		}),
		databaseType: z
			.enum(["postgres", "mariadb", "mysql", "mongo", "web-server", "libsql"])
			.optional(),
		backupType: z.enum(["database", "compose"]).default("database"),
		metadata: z
			.object({
				...composeBackupMetadataEngineShape,
				serviceName: z.string().optional(),
			})
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.backupType === "compose" && !data.databaseType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Database type is required for compose backups",
				path: ["databaseType"],
			});
		}

		if (data.backupType === "compose" && !data.metadata?.serviceName) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Service name is required for compose backups",
				path: ["metadata", "serviceName"],
			});
		}

		if (data.backupType === "compose") {
			refineComposeBackupMetadata(data.databaseType, data.metadata, ctx);
		}
	});

export const RestoreBackup = ({
	id,
	databaseType,
	runtimeWorkerId,
	backupType = "database",
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

	const form = useForm({
		defaultValues: {
			destinationId: "",
			backupFile: "",
			databaseName:
				databaseType === "web-server"
					? "docklands"
					: databaseType === "libsql"
						? "iku.db"
						: "",
			databaseType:
				backupType === "compose" ? ("postgres" as DatabaseType) : databaseType,
			backupType: backupType,
			metadata: {},
		},
		resolver: zodResolver(RestoreBackupSchema),
	});

	const destinationId = form.watch("destinationId");
	const currentDatabaseType = form.watch("databaseType");
	const metadata = form.watch("metadata");

	const debouncedSetSearch = debounce((value: string) => {
		setDebouncedSearchTerm(value);
	}, 350);

	const handleSearchChange = (value: string) => {
		setSearch(value);
		debouncedSetSearch(value);
	};

	const { data: files = [], isPending } = api.backup.listBackupFiles.useQuery(
		{
			destinationId: destinationId,
			search: debouncedSearchTerm,
			runtimeWorkerId: runtimeWorkerId ?? "",
		},
		{
			enabled: isOpen && !!destinationId,
		},
	);

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);

	api.backup.restoreBackupWithLogs.useSubscription(
		{
			databaseId: id,
			databaseType: currentDatabaseType as DatabaseType,
			databaseName: form.watch("databaseName"),
			backupFile: form.watch("backupFile"),
			destinationId: form.watch("destinationId"),
			backupType: backupType,
			metadata: metadata,
		},
		{
			enabled: isDeploying,
			onData(log) {
				if (!isDrawerOpen) {
					setIsDrawerOpen(true);
				}

				if (log === "Restore completed successfully!") {
					setIsDeploying(false);
				}
				const parsedLogs = parseLogs(log);
				setFilteredLogs((prev) => [...prev, ...parsedLogs]);
			},
			onError(error) {
				logger.error("restore logs error:", error);
				toast.warning("Restore log stream failed");
				setIsDeploying(false);
			},
		},
	);

	const onSubmit = async (data: z.infer<typeof RestoreBackupSchema>) => {
		if (backupType === "compose" && !data.databaseType) {
			toast.error("Please select a database type");
			return;
		}
		setIsDeploying(true);
	};

	const {
		services,
		isLoadingServices,
		cacheType,
		setCacheType,
		refetchServices,
	} = useComposeServices(id, { enabled: backupType === "compose" });

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button variant="outline">
						<RotateCcw className="mr-2 size-4" />
						Restore Backup
					</Button>
				}
			/>
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title className="flex items-center">
						<RotateCcw className="mr-2 size-4" />
						Restore Backup
					</Dialog.Title>
					<Dialog.Description>
						Select a destination and search for backup files
					</Dialog.Description>
				</div>

				<Form {...form}>
					<form
						id="hook-form-restore-backup"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<DestinationPicker control={form.control} name="destinationId" />

						<FormField
							control={form.control}
							name="backupFile"
							render={({ field }) => (
								<FormItem className="">
									<FormLabel className="flex items-center justify-between">
										Search Backup Files
										{field.value && (
											<Badge variant="outline" className="truncate">
												{field.value}
												<Copy
													className="ml-2 size-4 cursor-pointer"
													onClick={(e: React.MouseEvent<SVGSVGElement>) => {
														e.stopPropagation();
														e.preventDefault();
														copy(field.value);
														toast.success("Backup file copied to clipboard");
													}}
												/>
											</Badge>
										)}
									</FormLabel>
									<Popover modal>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant="outline"
													className={cn(
														"w-full justify-between !bg-kumo-line",
														!field.value && "text-kumo-subtle",
													)}
												>
													<span className="truncate text-left flex-1 w-52">
														{field.value || "Search and select a backup file"}
													</span>
													<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="p-0" align="start">
											<Command items={[]}>
												<CommandInput
													placeholder="Search backup files..."
													value={search}
													onChange={(event) =>
														handleSearchChange(event.target.value)
													}
													className="h-9"
												/>
												{isPending ? (
													<div className="py-6 text-center text-sm">
														Loading backup files...
													</div>
												) : files.length === 0 && search ? (
													<div className="py-6 text-center text-sm text-kumo-subtle">
														No backup files found for "{search}"
													</div>
												) : files.length === 0 ? (
													<div className="py-6 text-center text-sm text-kumo-subtle">
														No backup files available
													</div>
												) : (
													<ScrollArea className="h-64">
														<CommandGroup className="w-96">
															{files?.map((file) => (
																<CommandItem
																	value={file.Path}
																	key={file.Path}
																	onSelect={() => {
																		form.setValue("backupFile", file.Path);
																		if (file.IsDir) {
																			setSearch(`${file.Path}/`);
																			setDebouncedSearchTerm(`${file.Path}/`);
																		} else {
																			setSearch(file.Path);
																			setDebouncedSearchTerm(file.Path);
																		}
																	}}
																>
																	<div className="flex w-full flex-col gap-1">
																		<div className="flex w-full justify-between">
																			<span className="font-medium">
																				{file.Path}
																			</span>

																			<CheckIcon
																				className={cn(
																					"ml-auto h-4 w-4",
																					file.Path === field.value
																						? "opacity-100"
																						: "opacity-0",
																				)}
																			/>
																		</div>
																		<div className="flex items-center gap-4 text-xs text-kumo-subtle">
																			<span>
																				Size: {formatBytes(file.Size)}
																			</span>
																			{file.IsDir && (
																				<span className="text-kumo-info">
																					Directory
																				</span>
																			)}
																			{file.Hashes?.MD5 && (
																				<span>MD5: {file.Hashes.MD5}</span>
																			)}
																		</div>
																	</div>
																</CommandItem>
															))}
														</CommandGroup>
													</ScrollArea>
												)}
											</Command>
										</PopoverContent>
									</Popover>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="databaseName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Database Name</FormLabel>
									<FormControl>
										<Input
											placeholder="Enter database name"
											{...field}
											disabled={
												databaseType === "web-server" ||
												databaseType === "libsql"
											}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{backupType === "compose" && (
							<>
								<FormField
									control={form.control}
									name="databaseType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Database Type</FormLabel>
											<Select
												aria-label="Restore database type"
												value={field.value}
												onValueChange={(value) => {
													if (value === null) return;
													field.onChange(value);
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

								<ComposeServicePicker
									control={form.control}
									name="metadata.serviceName"
									services={services}
									cacheType={cacheType}
									setCacheType={setCacheType}
									isLoadingServices={isLoadingServices}
									refetchServices={refetchServices}
									ariaLabel="Restore target service"
								/>

								<ComposeCredentialFields
									databaseType={currentDatabaseType}
									control={form.control}
									placeholder={(_engine, field) =>
										field.name === "databaseRootPassword"
											? "Enter root password"
											: field.isPassword
												? "Enter database password"
												: "Enter database user"
									}
								/>
							</>
						)}

						<div>
							<Button
								loading={isDeploying}
								form="hook-form-restore-backup"
								type="submit"
								// disabled={
								// 	!form.watch("backupFile") ||
								// 	(backupType === "compose" && !form.watch("databaseType"))
								// }
							>
								Restore
							</Button>
						</div>
					</form>
				</Form>

				<DrawerLogs
					isOpen={isDrawerOpen}
					onClose={() => {
						setIsDrawerOpen(false);
						setFilteredLogs([]);
						setIsDeploying(false);
						// refetch();
					}}
					filteredLogs={filteredLogs}
				/>
			</Dialog>
		</Dialog.Root>
	);
};
