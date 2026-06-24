import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type RouterOutputs } from "@/client/api/trpc";
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
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("users");

/** Shape returned by workspace.allForPermissions (admin only). Used for the permissions UI. */
type ProjectForPermissions =
	RouterOutputs["workspaces"]["allForPermissions"][number];
type EnvironmentForPermissions = ProjectForPermissions["environments"][number];

type Environment = EnvironmentForPermissions;

export type Services = {
	appName: string;
	runtimeWorkerId?: string | null;
	name: string;
	type:
		| "mariadb"
		| "application"
		| "postgres"
		| "mysql"
		| "mongo"
		| "redis"
		| "compose"
		| "libsql";
	description?: string | null;
	id: string;
	createdAt: string;
	status?: "idle" | "running" | "done" | "error";
};

export const extractServices = (data: Environment | undefined) => {
	const applications: Services[] = (data?.applications?.map((item) => ({
		appName: item.appName,
		name: item.name,
		type: "application",
		id: item.applicationId,
		createdAt: item.createdAt,
		status: item.applicationStatus,
		description: item.description,
		runtimeWorkerId: item.runtimeWorkerId,
	})) ?? []) as Services[];

	// The six managed-database engines now share one `database` collection,
	// discriminated by the row's `engine` (which is the service type).
	const databases: Services[] =
		data?.database.map((item) => ({
			appName: item.appName,
			name: item.name,
			type: item.engine,
			id: item.databaseId,
			createdAt: item.createdAt,
			status: item.applicationStatus,
			description: item.description,
			runtimeWorkerId: item.runtimeWorkerId,
		})) || [];

	const compose: Services[] = (data?.compose?.map((item) => ({
		appName: item.appName,
		name: item.name,
		type: "compose",
		id: item.composeId,
		createdAt: item.createdAt,
		status: item.composeStatus,
		description: item.description,
		runtimeWorkerId: item.runtimeWorkerId,
	})) ?? []) as Services[];

	applications.push(...databases, ...compose);

	applications.sort((a, b) => {
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});

	return applications;
};

const addPermissions = z.object({
	accessedWorkspaces: z.array(z.string()).optional(),
	accessedEnvironments: z.array(z.string()).optional(),
	accessedServices: z.array(z.string()).optional(),
	accessedGitProviders: z.array(z.string()).optional(),
	accessedRuntimeWorkers: z.array(z.string()).optional(),
});

type AddPermissions = z.infer<typeof addPermissions>;

interface Props {
	userId: string;
	role?: string;
}

export const AddUserPermissions = ({ userId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const { data: workspaces } = api.workspaces.allForPermissions.useQuery(
		undefined,
		{
			enabled: isOpen,
		},
	);
	const { data: gitProviders } = api.gitProvider.allForPermissions.useQuery(
		undefined,
		{
			enabled: isOpen,
		},
	);

	const { data: runtimeWorkers } = api.runtimeWorker.allForPermissions.useQuery(
		undefined,
		{
			enabled: isOpen,
		},
	);

	const { data, refetch } = api.user.one.useQuery(
		{
			userId,
		},
		{
			enabled: !!userId,
		},
	);

	const { mutateAsync, isError, error, isPending } =
		api.user.assignPermissions.useMutation();

	const form = useForm({
		defaultValues: {
			accessedWorkspaces: [],
			accessedEnvironments: [],
			accessedServices: [],
			accessedGitProviders: [],
			accessedRuntimeWorkers: [],
		},
		resolver: zodResolver(addPermissions),
	});

	useEffect(() => {
		if (data && isOpen) {
			form.reset({
				accessedWorkspaces: data.accessedWorkspaces || [],
				accessedEnvironments: data.accessedEnvironments || [],
				accessedServices: data.accessedServices || [],
				accessedGitProviders: data.accessedGitProviders || [],
				accessedRuntimeWorkers: data.accessedRuntimeWorkers || [],
			});
		}
	}, [form, form.reset, data, isOpen]);

	const onSubmit = async (data: AddPermissions) => {
		await mutateAsync({
			id: userId,
			accessedWorkspaces: data.accessedWorkspaces || [],
			accessedEnvironments: data.accessedEnvironments || [],
			accessedServices: data.accessedServices || [],
			accessedGitProviders: data.accessedGitProviders || [],
			accessedRuntimeWorkers: data.accessedRuntimeWorkers || [],
		})
			.then(async () => {
				toast.success("Permissions updated");
				refetch();
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error(err);
				toast.error("Error updating the permissions");
			});
	};
	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				nativeButton={false}
				className=""
				render={
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onSelect={(e) => e.preventDefault()}
					>
						Add Permissions
					</DropdownMenu.Item>
				}
			/>
			<Dialog className="max-h-[85vh]  sm:max-w-4xl">
				<div>
					<Dialog.Title>Permissions</Dialog.Title>
					<Dialog.Description>Add or remove permissions</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-add-permissions"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid  grid-cols-1 md:grid-cols-2  w-full gap-4"
					>
						<div className="md:col-span-2 rounded-lg border p-3 bg-kumo-fill/50 text-sm text-kumo-subtle">
							Capabilities (what a user can do) are defined by their role —
							assign or create roles under Settings → Roles. This dialog
							controls which specific workspaces, environments, and services a
							non-admin user can access.
						</div>
						<FormField
							control={form.control}
							name="accessedWorkspaces"
							render={() => (
								<FormItem className="md:col-span-2">
									<div className="mb-4">
										<FormLabel className="text-base">Workspaces</FormLabel>
										<FormDescription>
											Select the workspaces that the user can access
										</FormDescription>
									</div>
									{workspaces?.length === 0 && (
										<p className="text-sm text-kumo-subtle">
											No workspaces found
										</p>
									)}
									<div className="grid md:grid-cols-1 gap-4">
										{workspaces?.map((workspace, projectIndex) => {
											return (
												<FormField
													key={`workspace-${projectIndex}`}
													control={form.control}
													name="accessedWorkspaces"
													render={({ field }) => {
														return (
															<FormItem
																key={workspace.workspaceId}
																className="flex flex-col items-start rounded-lg p-4 border"
															>
																{/* Workspace header */}
																<div className="flex flex-row gap-4 items-center w-full">
																	<FormControl>
																		<Checkbox
																			checked={field.value?.includes(
																				workspace.workspaceId,
																			)}
																			onCheckedChange={(checked) => {
																				if (checked) {
																					// Add the workspace
																					field.onChange([
																						...(field.value || []),
																						workspace.workspaceId,
																					]);
																				} else {
																					// Remove the workspace
																					field.onChange(
																						field.value?.filter(
																							(value) =>
																								value !== workspace.workspaceId,
																						),
																					);

																					// Also remove all environments and services from this workspace
																					const currentEnvs =
																						form.getValues(
																							"accessedEnvironments",
																						) || [];
																					const currentServices =
																						form.getValues(
																							"accessedServices",
																						) || [];

																					// Get all environment IDs from this workspace
																					const projectEnvIds =
																						workspace.environments.map(
																							(env) => env.environmentId,
																						);

																					// Get all service IDs from this workspace
																					const projectServiceIds =
																						workspace.environments.flatMap(
																							(env) =>
																								extractServices(env).map(
																									(service) => service.id,
																								),
																						);

																					// Remove environments and services from this workspace
																					form.setValue(
																						"accessedEnvironments",
																						currentEnvs.filter(
																							(envId) =>
																								!projectEnvIds.includes(envId),
																						),
																					);
																					form.setValue(
																						"accessedServices",
																						currentServices.filter(
																							(serviceId) =>
																								!projectServiceIds.includes(
																									serviceId,
																								),
																						),
																					);
																				}
																			}}
																		/>
																	</FormControl>
																	<FormLabel className="text-base font-semibold text-kumo-brand">
																		{workspace.name}
																	</FormLabel>
																</div>

																{/* Environments */}
																<div className="ml-6 w-full space-y-3">
																	{workspace.environments.length === 0 && (
																		<p className="text-sm text-kumo-subtle">
																			No environments found
																		</p>
																	)}
																	{workspace.environments.map(
																		(environment, envIndex) => {
																			const services =
																				extractServices(environment);
																			return (
																				<div
																					key={`env-${envIndex}`}
																					className="border-l-2 border-kumo-hairline pl-4"
																				>
																					{/* Environment Header with Checkbox */}
																					<FormField
																						key={`env-${envIndex}`}
																						control={form.control}
																						name="accessedEnvironments"
																						render={({ field: envField }) => (
																							<FormItem className="flex flex-row items-center space-x-3 space-y-0 mb-2">
																								<FormControl>
																									<Checkbox
																										checked={envField.value?.includes(
																											environment.environmentId,
																										)}
																										onCheckedChange={(
																											checked,
																										) => {
																											if (checked) {
																												// Add the environment
																												envField.onChange([
																													...(envField.value ||
																														[]),
																													environment.environmentId,
																												]);

																												// Auto-select the workspace if not already selected
																												const currentWorkspaces =
																													form.getValues(
																														"accessedWorkspaces",
																													) || [];
																												if (
																													!currentWorkspaces.includes(
																														workspace.workspaceId,
																													)
																												) {
																													form.setValue(
																														"accessedWorkspaces",
																														[
																															...currentWorkspaces,
																															workspace.workspaceId,
																														],
																													);
																												}
																											} else {
																												// Remove the environment
																												envField.onChange(
																													envField.value?.filter(
																														(value) =>
																															value !==
																															environment.environmentId,
																													),
																												);

																												// Also remove all services from this environment
																												const currentServices =
																													form.getValues(
																														"accessedServices",
																													) || [];
																												const environmentServiceIds =
																													services.map(
																														(service) =>
																															service.id,
																													);

																												form.setValue(
																													"accessedServices",
																													currentServices.filter(
																														(serviceId) =>
																															!environmentServiceIds.includes(
																																serviceId,
																															),
																													),
																												);
																											}
																										}}
																									/>
																								</FormControl>
																								<div className="flex items-center gap-2">
																									<div className="w-2 h-2 bg-kumo-info rounded-full" />
																									<FormLabel className="text-sm font-medium text-kumo-default cursor-pointer">
																										{environment.name}
																									</FormLabel>
																									<span className="text-xs text-kumo-subtle">
																										({services.length} services)
																									</span>
																								</div>
																							</FormItem>
																						)}
																					/>

																					{/* Services */}
																					<div className="ml-4 space-y-2">
																						{services.length === 0 && (
																							<p className="text-xs text-kumo-subtle">
																								No services found
																							</p>
																						)}
																						{services.map(
																							(service, serviceIndex) => (
																								<FormField
																									key={`service-${serviceIndex}`}
																									control={form.control}
																									name="accessedServices"
																									render={({
																										field: serviceField,
																									}) => {
																										return (
																											<FormItem
																												key={service.id}
																												className="flex flex-row items-center space-x-3 space-y-0"
																											>
																												<FormControl>
																													<Checkbox
																														checked={serviceField.value?.includes(
																															service.id,
																														)}
																														onCheckedChange={(
																															checked,
																														) => {
																															if (checked) {
																																// Add the service
																																serviceField.onChange(
																																	[
																																		...(serviceField.value ||
																																			[]),
																																		service.id,
																																	],
																																);

																																// Auto-select the environment if not already selected
																																const currentEnvs =
																																	form.getValues(
																																		"accessedEnvironments",
																																	) || [];
																																if (
																																	!currentEnvs.includes(
																																		environment.environmentId,
																																	)
																																) {
																																	form.setValue(
																																		"accessedEnvironments",
																																		[
																																			...currentEnvs,
																																			environment.environmentId,
																																		],
																																	);
																																}

																																// Auto-select the workspace if not already selected
																																const currentWorkspaces =
																																	form.getValues(
																																		"accessedWorkspaces",
																																	) || [];
																																if (
																																	!currentWorkspaces.includes(
																																		workspace.workspaceId,
																																	)
																																) {
																																	form.setValue(
																																		"accessedWorkspaces",
																																		[
																																			...currentWorkspaces,
																																			workspace.workspaceId,
																																		],
																																	);
																																}
																															} else {
																																// Remove the service
																																serviceField.onChange(
																																	serviceField.value?.filter(
																																		(value) =>
																																			value !==
																																			service.id,
																																	),
																																);
																															}
																														}}
																													/>
																												</FormControl>
																												<div className="flex items-center gap-2">
																													<div
																														className={`w-1.5 h-1.5 rounded-full ${
																															service.type ===
																															"application"
																																? "bg-kumo-success"
																																: service.type ===
																																		"compose"
																																	? "bg-kumo-info"
																																	: "bg-kumo-warning"
																														}`}
																													/>
																													<FormLabel className="text-sm text-kumo-subtle cursor-pointer">
																														{service.name}
																													</FormLabel>
																													<span className="text-xs text-kumo-subtle/70 capitalize">
																														({service.type})
																													</span>
																												</div>
																											</FormItem>
																										);
																									}}
																								/>
																							),
																						)}
																					</div>
																				</div>
																			);
																		},
																	)}
																</div>
															</FormItem>
														);
													}}
												/>
											);
										})}
									</div>

									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="accessedGitProviders"
							render={() => (
								<FormItem className="md:col-span-2">
									<div className="mb-4">
										<FormLabel className="text-base">Git Providers</FormLabel>
										<FormDescription>
											Select the Git Providers that the user can access
										</FormDescription>
									</div>
									{gitProviders?.length === 0 && (
										<p className="text-sm text-kumo-subtle">
											No git providers found
										</p>
									)}
									<div className="grid md:grid-cols-1 gap-2">
										{gitProviders?.map((provider) => (
											<FormField
												key={provider.gitProviderId}
												control={form.control}
												name="accessedGitProviders"
												render={({ field }) => (
													<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
														<FormControl>
															<Checkbox
																checked={field.value?.includes(
																	provider.gitProviderId,
																)}
																onCheckedChange={(checked) => {
																	if (checked) {
																		field.onChange([
																			...(field.value || []),
																			provider.gitProviderId,
																		]);
																	} else {
																		field.onChange(
																			field.value?.filter(
																				(v) => v !== provider.gitProviderId,
																			),
																		);
																	}
																}}
															/>
														</FormControl>
														<div className="flex items-center gap-2">
															<FormLabel className="text-sm cursor-pointer">
																{provider.name}
															</FormLabel>
															<span className="text-xs text-kumo-subtle capitalize">
																({provider.providerType})
															</span>
														</div>
													</FormItem>
												)}
											/>
										))}
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="accessedRuntimeWorkers"
							render={() => (
								<FormItem className="md:col-span-2">
									<div className="mb-4">
										<FormLabel className="text-base">Runtime Workers</FormLabel>
										<FormDescription>
											Select the runtime workers that the user can access
										</FormDescription>
									</div>
									{runtimeWorkers?.length === 0 && (
										<p className="text-sm text-kumo-subtle">
											No runtime workers found
										</p>
									)}
									<div className="grid md:grid-cols-1 gap-2">
										{runtimeWorkers?.map((runtimeWorker) => (
											<FormField
												key={runtimeWorker.runtimeWorkerId}
												control={form.control}
												name="accessedRuntimeWorkers"
												render={({ field }) => (
													<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
														<FormControl>
															<Checkbox
																checked={field.value?.includes(
																	runtimeWorker.runtimeWorkerId,
																)}
																onCheckedChange={(checked) => {
																	if (checked) {
																		field.onChange([
																			...(field.value || []),
																			runtimeWorker.runtimeWorkerId,
																		]);
																	} else {
																		field.onChange(
																			field.value?.filter(
																				(v) =>
																					v !== runtimeWorker.runtimeWorkerId,
																			),
																		);
																	}
																}}
															/>
														</FormControl>
														<div className="flex items-center gap-2">
															<FormLabel className="text-sm cursor-pointer">
																{runtimeWorker.name}
															</FormLabel>
															<span className="text-xs text-kumo-subtle">
																({runtimeWorker.ipAddress})
															</span>
															<span className="text-xs text-kumo-subtle capitalize">
																{runtimeWorker.runtimeWorkerType}
															</span>
														</div>
													</FormItem>
												)}
											/>
										))}
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex w-full flex-row justify-end md:col-span-2">
							<Button
								loading={isPending}
								form="hook-form-add-permissions"
								type="submit"
							>
								Update
							</Button>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
