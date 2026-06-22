import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertTriangle, Database, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { slugify } from "@/shared/slug";
import { APP_NAME_MESSAGE, APP_NAME_REGEX } from "@/shared/validation/schema";
import { PlacementFormField } from "./placement-select";

type DbType = z.infer<typeof mySchema>["type"];

const dockerImageDefaultPlaceholder: Record<DbType, string> = {
	mongo: "mongo:8",
	libsql: "ghcr.io/tursodatabase/libsql-server:v0.24.32",
	mariadb: "mariadb:11",
	mysql: "mysql:8",
	postgres: "postgres:18",
	redis: "redis:7",
};

const databasesUserDefaultPlaceholder: Record<
	Exclude<DbType, "redis">,
	string
> = {
	libsql: "libsql",
	mariadb: "mariadb",
	mongo: "mongo",
	mysql: "mysql",
	postgres: "postgres",
};

const baseDatabaseSchema = z.object({
	name: z.string().min(1, "Name required"),
	appName: z
		.string()
		.min(1, {
			message: "App name is required",
		})
		.regex(APP_NAME_REGEX, {
			message: APP_NAME_MESSAGE,
		}),
	databasePassword: z
		.string()
		.regex(/^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~`]*$/, {
			message:
				"Password contains invalid characters. Please avoid: $ ! ' \" \\ / and space characters for database compatibility",
		}),
	dockerImage: z.string(),
	description: z.string().nullable(),
	serverId: z.string().nullable(),
});

const mySchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("libsql"),
				dockerImage: z
					.string()
					.default("ghcr.io/tursodatabase/libsql-server:v0.24.32"),
				databaseUser: z.string().default("libsql"),
				sqldNode: z.enum(["primary", "replica"]).default("primary"),
				sqldPrimaryUrl: z.string().optional(),
				enableNamespaces: z.boolean().default(false),
			})
			.merge(baseDatabaseSchema),
		z
			.object({
				type: z.literal("mariadb"),
				dockerImage: z.string().default("mariadb:4"),
				databaseRootPassword: z
					.string()
					.regex(/^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~`]*$/, {
						message:
							"Password contains invalid characters. Please avoid: $ ! ' \" \\ / and space characters for database compatibility",
					})
					.optional(),
				databaseUser: z.string().default("mariadb"),
				databaseName: z.string().default("mariadb"),
			})
			.merge(baseDatabaseSchema),
		z
			.object({
				type: z.literal("mongo"),
				databaseUser: z.string().default("mongo"),
				replicaSets: z.boolean().default(false),
			})
			.merge(baseDatabaseSchema),
		z
			.object({
				type: z.literal("mysql"),
				databaseRootPassword: z
					.string()
					.regex(/^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~`]*$/, {
						message:
							"Password contains invalid characters. Please avoid: $ ! ' \" \\ / and space characters for database compatibility",
					})
					.optional(),
				databaseUser: z.string().default("mysql"),
				databaseName: z.string().default("mysql"),
			})
			.merge(baseDatabaseSchema),
		z
			.object({
				type: z.literal("postgres"),
				databaseName: z.string().default("postgres"),
				databaseUser: z.string().default("postgres"),
			})
			.merge(baseDatabaseSchema),
		z
			.object({
				type: z.literal("redis"),
			})
			.merge(baseDatabaseSchema),
	])
	.superRefine((data, ctx) => {
		if (data.type === "libsql") {
			if (data.sqldNode === "replica" && !data.sqldPrimaryUrl) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["sqldPrimaryUrl"],
					message: "sqldPrimaryUrl is required when sqldNode is 'replica'.",
				});
			}
			if (data.sqldNode !== "replica" && data.sqldPrimaryUrl) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["sqldPrimaryUrl"],
					message:
						"sqldPrimaryUrl should not be provided when sqldNode is not 'replica'.",
				});
			}
		}
	});

const databasesMap = {
	postgres: {
		icon: <PostgresqlIcon />,
		label: "PostgreSQL",
	},
	mongo: {
		icon: <MongodbIcon />,
		label: "MongoDB",
	},
	mariadb: {
		icon: <MariadbIcon />,
		label: "MariaDB",
	},
	mysql: {
		icon: <MysqlIcon />,
		label: "MySQL",
	},
	redis: {
		icon: <RedisIcon />,
		label: "Redis",
	},
	libsql: {
		icon: <LibsqlIcon className="size-10" />,
		label: "libSQL",
	},
};

type AddDatabase = z.infer<typeof mySchema>;

interface Props {
	environmentId: string;
	projectName?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	hideTrigger?: boolean;
	initialType?: DbType;
}

export const AddDatabase = ({
	environmentId,
	projectName,
	open: controlledOpen,
	onOpenChange,
	hideTrigger = false,
	initialType,
}: Props) => {
	const utils = api.useUtils();
	const [internalVisible, setInternalVisible] = useState(false);
	const visible = controlledOpen ?? internalVisible;
	const setVisible = onOpenChange ?? setInternalVisible;
	const slug = slugify(projectName);
	const defaultDatabaseType = initialType ?? "postgres";
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: webServerSettings } =
		api.settings.getWebServerSettings.useQuery();
	const showLocalOption = !isCloud && !webServerSettings?.remoteServersOnly;
	const { data: servers } = api.server.withSSHKey.useQuery();
	const libsqlMutation = api.libsql.create.useMutation();
	const mariadbMutation = api.mariadb.create.useMutation();
	const mongoMutation = api.mongo.create.useMutation();
	const mysqlMutation = api.mysql.create.useMutation();
	const postgresMutation = api.postgres.create.useMutation();
	const redisMutation = api.redis.create.useMutation();

	// Get environment data to extract the backing projectId.
	const { data: environment } = api.environment.one.useQuery({ environmentId });

	const hasServers = servers && servers.length > 0;
	// Show placement only when there is more than the local runtime to choose.
	const shouldShowServerDropdown = hasServers;

	const form = useForm({
		defaultValues: {
			type: defaultDatabaseType,
			dockerImage: "",
			name: "",
			appName: `${slug}-`,
			databasePassword: "",
			description: "",
			databaseName: "",
			databaseUser: "",
			serverId: null,
		},
		resolver: zodResolver(mySchema),
	});

	useEffect(() => {
		if (!visible || !initialType) return;
		form.setValue("type", initialType, { shouldDirty: false });
	}, [form, initialType, visible]);

	const sqldNode = form.watch("sqldNode");
	const type = form.watch("type");
	const activeMutation = {
		libsql: libsqlMutation,
		mariadb: mariadbMutation,
		mongo: mongoMutation,
		mysql: mysqlMutation,
		postgres: postgresMutation,
		redis: redisMutation,
	};

	const resetForm = (databaseType: DbType) => {
		const base = {
			dockerImage: "",
			name: "",
			appName: `${slug}-`,
			databasePassword: "",
			description: "",
			serverId: null,
		};

		switch (databaseType) {
			case "libsql":
				form.reset({
					...base,
					type: "libsql",
					databaseUser: "",
					sqldNode: "primary",
					sqldPrimaryUrl: "",
					enableNamespaces: false,
				});
				return;
			case "mariadb":
				form.reset({
					...base,
					type: "mariadb",
					databaseRootPassword: "",
					databaseName: "",
					databaseUser: "",
				});
				return;
			case "mongo":
				form.reset({
					...base,
					type: "mongo",
					databaseUser: "",
					replicaSets: false,
				});
				return;
			case "mysql":
				form.reset({
					...base,
					type: "mysql",
					databaseRootPassword: "",
					databaseName: "",
					databaseUser: "",
				});
				return;
			case "postgres":
				form.reset({
					...base,
					type: "postgres",
					databaseName: "",
					databaseUser: "",
				});
				return;
			case "redis":
				form.reset({
					...base,
					type: "redis",
				});
				return;
		}
	};

	const onSubmit = async (data: AddDatabase) => {
		const defaultDockerImage =
			data.dockerImage || dockerImageDefaultPlaceholder[data.type];

		let promise: Promise<unknown> | null = null;
		const commonParams = {
			name: data.name,
			appName: data.appName,
			dockerImage: defaultDockerImage,
			serverId: data.serverId === "docklands" ? undefined : data.serverId,
			environmentId,
			description: data.description,
		};

		if (data.type === "libsql") {
			promise = libsqlMutation.mutateAsync({
				...commonParams,
				sqldNode: data.sqldNode,
				sqldPrimaryUrl: data.sqldPrimaryUrl ?? null,
				enableNamespaces: data.enableNamespaces,
				databasePassword: data.databasePassword,
				databaseUser:
					data.databaseUser || databasesUserDefaultPlaceholder[data.type],
				serverId: data.serverId === "docklands" ? null : data.serverId,
			});
		} else if (data.type === "mariadb") {
			promise = mariadbMutation.mutateAsync({
				...commonParams,
				databasePassword: data.databasePassword,
				databaseRootPassword: data.databaseRootPassword || "",
				databaseName: data.databaseName || "mariadb",
				databaseUser:
					data.databaseUser || databasesUserDefaultPlaceholder[data.type],
				serverId: data.serverId === "docklands" ? null : data.serverId,
			});
		} else if (data.type === "mongo") {
			promise = mongoMutation.mutateAsync({
				...commonParams,
				databasePassword: data.databasePassword,
				databaseUser:
					data.databaseUser || databasesUserDefaultPlaceholder[data.type],
				serverId: data.serverId === "docklands" ? null : data.serverId,
				replicaSets: data.replicaSets,
			});
		} else if (data.type === "mysql") {
			promise = mysqlMutation.mutateAsync({
				...commonParams,
				databasePassword: data.databasePassword,
				databaseName: data.databaseName || "mysql",
				databaseUser:
					data.databaseUser || databasesUserDefaultPlaceholder[data.type],
				serverId: data.serverId === "docklands" ? null : data.serverId,
				databaseRootPassword: data.databaseRootPassword || "",
			});
		} else if (data.type === "postgres") {
			promise = postgresMutation.mutateAsync({
				...commonParams,
				databasePassword: data.databasePassword,
				databaseName: data.databaseName || "postgres",
				databaseUser:
					data.databaseUser || databasesUserDefaultPlaceholder[data.type],
				serverId: data.serverId === "docklands" ? null : data.serverId,
			});
		} else if (data.type === "redis") {
			promise = redisMutation.mutateAsync({
				...commonParams,
				databasePassword: data.databasePassword,
				serverId: data.serverId === "docklands" ? null : data.serverId,
			});
		}

		if (promise) {
			await promise
				.then(async () => {
					toast.success("Database Created");
					resetForm(defaultDatabaseType);
					setVisible(false);
					// Refresh the workspace environment data.
					await utils.environment.one.invalidate({
						environmentId,
					});
				})
				.catch(() => {
					toast.error("Error creating a database");
				});
		}
	};

	return (
		<Dialog.Root open={visible} onOpenChange={setVisible}>
			{!hideTrigger && (
				<Dialog.Trigger className="w-full">
					<DropdownMenu.Item
						className="w-full cursor-pointer space-x-3"
						onSelect={(e) => e.preventDefault()}
					>
						<Database className="size-4 text-muted-foreground" />
						<span>Database</span>
					</DropdownMenu.Item>
				</Dialog.Trigger>
			)}
			<Dialog className="md:max-h-[90vh]  sm:max-w-2xl">
				<div>
					<Dialog.Title>Create Database</Dialog.Title>
				</div>

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
									<FormLabel className="text-muted-foreground">
										Select a database
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
												Select a database
											</Radio.Legend>
											{Object.entries(databasesMap).map(([key, value]) => (
												<Radio.Item
													key={key}
													value={key}
													className="min-h-24"
													label={
														<span className="flex flex-col items-center gap-2 text-center">
															{value.icon}
															<span>{value.label}</span>
														</span>
													}
												/>
											))}
										</Radio.Group>
									</FormControl>
									<FormMessage />
									{activeMutation[field.value].isError && (
										<div className="flex flex-row gap-4 rounded-lg bg-red-50 p-2 dark:bg-red-950">
											<AlertTriangle className="text-red-600 dark:text-red-400" />
											<span className="text-sm text-red-600 dark:text-red-400">
												{activeMutation[field.value].error?.message}
											</span>
										</div>
									)}
								</FormItem>
							)}
						/>
						<div className="flex flex-col gap-4">
							<FormLabel className="text-lg font-semibold leading-none tracking-tight">
								Configure database
							</FormLabel>
							<div className="flex flex-col gap-2">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Name"
													{...field}
													onChange={(e) => {
														const val = e.target.value || "";
														const serviceName = slugify(val.trim());
														form.setValue("appName", `${slug}-${serviceName}`);
														field.onChange(val);
													}}
												/>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								{shouldShowServerDropdown && (
									<PlacementFormField
										control={form.control}
										name="serverId"
										ariaLabel="Database placement"
										workers={servers}
										showAutomaticPlacement={showLocalOption}
										optional={showLocalOption}
										description="Docklands uses automatic placement by default. Choose a runtime worker only when this database needs manual placement."
									/>
								)}
								<FormField
									control={form.control}
									name="appName"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="flex items-center gap-2">
												Service Name
												<TooltipProvider delay={0}>
													<Tooltip
														content={
															<>
																<p>Internal runtime service name.</p>
															</>
														}
														side="right"
														asChild
													>
														<HelpCircle className="size-4 text-muted-foreground" />
													</Tooltip>
												</TooltipProvider>
											</FormLabel>
											<FormControl>
												<Input placeholder="my-app" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													className="h-24"
													placeholder="Description"
													{...field}
													value={field.value || ""}
												/>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								{(type === "mariadb" ||
									type === "mysql" ||
									type === "postgres") && (
									<FormField
										control={form.control}
										name="databaseName"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Database Name</FormLabel>
												<FormControl>
													<Input placeholder="Database Name" {...field} />
												</FormControl>

												<FormMessage />
											</FormItem>
										)}
									/>
								)}

								{type === "libsql" && (
									<FormField
										control={form.control}
										name="sqldNode"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Sqld Node</FormLabel>
												<Select
													aria-label="LibSQL node"
													onValueChange={field.onChange}
													defaultValue={field.value || "primary"}
												>
													<></>
													<>
														<Select.Group>
															{["primary", "replica"].map((node) => (
																<Select.Option key={node} value={node}>
																	{node.charAt(0).toUpperCase() + node.slice(1)}
																</Select.Option>
															))}
														</Select.Group>
													</>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
								{type === "libsql" && sqldNode === "replica" && (
									<FormField
										control={form.control}
										name="sqldPrimaryUrl"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Sqld Primary URL</FormLabel>
												<FormControl>
													<Input
														placeholder={"https://<host>:<port>"}
														autoComplete="off"
														{...field}
													/>
												</FormControl>

												<FormMessage />
											</FormItem>
										)}
									/>
								)}
								{type === "libsql" && (
									<FormField
										control={form.control}
										name="enableNamespaces"
										render={({ field }) => {
											return (
												<FormItem>
													<FormLabel>Enable Namespaces</FormLabel>
													<FormControl>
														<Select
															aria-label="Enable LibSQL namespaces"
															onValueChange={(value) =>
																field.onChange(Boolean(value))
															}
															defaultValue={
																field.value ? String(field.value) : "false"
															}
														>
															<></>
															<>
																<Select.Group>
																	{["false", "true"].map((node) => (
																		<Select.Option key={node} value={node}>
																			{node.charAt(0).toUpperCase() +
																				node.slice(1)}
																		</Select.Option>
																	))}
																</Select.Group>
															</>
														</Select>
													</FormControl>

													<FormMessage />
												</FormItem>
											);
										}}
									/>
								)}
								{(type === "libsql" ||
									type === "mariadb" ||
									type === "mongo" ||
									type === "mysql" ||
									type === "postgres") && (
									<FormField
										control={form.control}
										name="databaseUser"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Database User</FormLabel>
												<FormControl>
													<Input
														placeholder={`Default ${databasesUserDefaultPlaceholder[type]}`}
														autoComplete="off"
														{...field}
													/>
												</FormControl>

												<FormMessage />
											</FormItem>
										)}
									/>
								)}

								<FormField
									control={form.control}
									name="databasePassword"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Database Password</FormLabel>
											<FormControl>
												<Input
													type="password"
													placeholder="******************"
													autoComplete="one-time-code"
													{...field}
												/>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								{(type === "mariadb" || type === "mysql") && (
									<FormField
										control={form.control}
										name="databaseRootPassword"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Database Root password</FormLabel>
												<FormControl>
													<Input
														type="password"
														placeholder="******************"
														{...field}
													/>
												</FormControl>

												<FormMessage />
											</FormItem>
										)}
									/>
								)}

								<FormField
									control={form.control}
									name="dockerImage"
									defaultValue={form.formState.defaultValues?.dockerImage}
									render={({ field }) => {
										return (
											<FormItem>
												<FormLabel>Container image</FormLabel>
												<FormControl>
													<Input
														placeholder={`Default ${dockerImageDefaultPlaceholder[type]}`}
														{...field}
													/>
												</FormControl>

												<FormMessage />
											</FormItem>
										);
									}}
								/>

								{type === "mongo" && (
									<FormField
										control={form.control}
										name="replicaSets"
										render={({ field }) => {
											return (
												<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm">
													<div className="space-y-0.5">
														<FormLabel>Use Replica Sets</FormLabel>
													</div>
													<FormControl>
														<Switch
															checked={field.value}
															onCheckedChange={field.onChange}
														/>
													</FormControl>

													<FormMessage />
												</FormItem>
											);
										}}
									/>
								)}
							</div>
						</div>
					</form>

					<div>
						<Button
							loading={form.formState.isSubmitting}
							form="hook-form"
							type="submit"
						>
							Create
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
