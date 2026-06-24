import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertTriangle, PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
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
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("image-registry");

const AddRegistrySchema = z.object({
	registryName: z.string().min(1, {
		message: "Registry name is required",
	}),
	username: z.string().min(1, {
		message: "Username is required",
	}),
	password: z.string(),
	registryUrl: z
		.string()
		.optional()
		.refine(
			(val) => {
				// If empty or undefined, skip validation (field is optional)
				if (!val || val.trim().length === 0) {
					return true;
				}
				// Validate that it's a valid hostname (no protocol, no path, optional port)
				// Valid formats: example.com, registry.example.com, [::1], example.com:5000
				// Invalid: https://example.com, example.com/path
				const trimmed = val.trim();
				// Check for protocol or path - these are not allowed
				if (/^https?:\/\//i.test(trimmed) || trimmed.includes("/")) {
					return false;
				}
				// Basic hostname validation: allow alphanumeric, dots, hyphens, underscores, and IPv6 in brackets
				// Allow optional port at the end
				const hostnameRegex =
					/^(?:\[[^\]]+\]|[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,253}[a-zA-Z0-9])?)(?::\d+)?$/;
				return hostnameRegex.test(trimmed);
			},
			{
				message:
					"Invalid registry URL. Please enter only the hostname (e.g., example.com or registry.example.com). Do not include protocol (https://) or paths.",
			},
		),
	imagePrefix: z.string(),
	runtimeWorkerId: z.string().optional(),
	isEditing: z.boolean().optional(),
});

type AddRegistry = z.infer<typeof AddRegistrySchema>;

interface Props {
	registryId?: string;
}

export const HandleImageRegistry = ({ registryId }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { data: registry } = api.registry.one.useQuery(
		{
			registryId: registryId || "",
		},
		{
			enabled: !!registryId,
		},
	);

	const updateRegistry = api.registry.update.useMutation();
	const createRegistry = api.registry.create.useMutation();
	const { mutateAsync, error, isError } = registryId
		? updateRegistry
		: createRegistry;
	const { data: deployWorkers } = api.runtimeWorker.withSSHKey.useQuery();
	const { data: buildWorkers } = api.runtimeWorker.buildWorkers.useQuery();
	const runtimeWorkers = [...(deployWorkers || []), ...(buildWorkers || [])];
	const {
		mutateAsync: testRegistry,
		isPending,
		error: testRegistryError,
		isError: testRegistryIsError,
	} = api.registry.testRegistry.useMutation();
	const {
		mutateAsync: testRegistryById,
		isPending: isPendingById,
		error: testRegistryByIdError,
		isError: testRegistryByIdIsError,
	} = api.registry.testRegistryById.useMutation();
	const form = useForm<AddRegistry>({
		defaultValues: {
			username: "",
			password: "",
			registryUrl: "",
			imagePrefix: "",
			registryName: "",
			runtimeWorkerId: "",
			isEditing: !!registryId,
		},
		resolver: zodResolver(
			AddRegistrySchema.refine(
				(data) => {
					// When creating a new registry, password is required
					if (
						!data.isEditing &&
						(!data.password || data.password.length === 0)
					) {
						return false;
					}
					return true;
				},
				{
					message: "Password is required",
					path: ["password"],
				},
			),
		),
	});

	const password = form.watch("password");
	const username = form.watch("username");
	const registryUrl = form.watch("registryUrl");
	const registryName = form.watch("registryName");
	const imagePrefix = form.watch("imagePrefix");
	const runtimeWorkerId = form.watch("runtimeWorkerId");
	const selectedRuntimeWorker = runtimeWorkers?.find(
		(runtimeWorker) => runtimeWorker.runtimeWorkerId === runtimeWorkerId,
	);

	useEffect(() => {
		if (registry) {
			form.reset({
				username: registry.username,
				password: "",
				registryUrl: registry.registryUrl,
				imagePrefix: registry.imagePrefix || "",
				registryName: registry.registryName,
				isEditing: true,
			});
		} else {
			form.reset({
				username: "",
				password: "",
				registryUrl: "",
				imagePrefix: "",
				runtimeWorkerId: "",
				isEditing: false,
			});
		}
	}, [form, form.reset, form.formState.isSubmitSuccessful, registry]);

	const onSubmit = async (data: AddRegistry) => {
		const payload: any = {
			registryName: data.registryName,
			username: data.username,
			registryUrl: data.registryUrl || "",
			registryType: "cloud",
			imagePrefix: data.imagePrefix,
			runtimeWorkerId: data.runtimeWorkerId,
			registryId: registryId || "",
		};

		// Only include password if it's been provided (not empty)
		// When editing, empty password means "keep the existing password"
		if (data.password && data.password.length > 0) {
			payload.password = data.password;
		}

		await mutateAsync(payload)
			.then(async (_data) => {
				await utils.registry.all.invalidate();
				toast.success(registryId ? "Registry updated" : "Registry added");
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error(err);
				toast.error(
					registryId ? "Error updating a registry" : "Error adding a registry",
				);
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					registryId ? (
						<Button
							aria-label="Edit image registry"
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
								Add Image Registry
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<Dialog.Header>
					<Dialog.Title>
						{registryId ? "Update" : "Add"} Image Registry
					</Dialog.Title>
					<Dialog.Description>
						Configure credentials for a container image registry.
					</Dialog.Description>
				</Dialog.Header>
				{(isError || testRegistryIsError || testRegistryByIdIsError) && (
					<div className="flex flex-row gap-4 rounded-lg bg-kumo-danger-tint p-2">
						<AlertTriangle className="text-kumo-danger" />
						<span className="text-sm text-kumo-danger">
							{testRegistryError?.message ||
								testRegistryByIdError?.message ||
								error?.message ||
								""}
						</span>
					</div>
				)}
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid grid-cols-1 sm:grid-cols-2 w-full gap-4"
					>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="registryName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Registry Name</FormLabel>
										<FormControl>
											<Input placeholder="Registry Name" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="username"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Username</FormLabel>
										<FormControl>
											<Input
												placeholder="Username"
												autoComplete="username"
												{...field}
											/>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Password{registryId && " (Optional)"}</FormLabel>
										{registryId && (
											<FormDescription>
												Leave blank to keep existing password. Enter new
												password to test or update it.
											</FormDescription>
										)}
										<FormControl>
											<Input
												placeholder={
													registryId
														? "Leave blank to keep existing"
														: "Password"
												}
												autoComplete="one-time-code"
												{...field}
												type="password"
											/>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="imagePrefix"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Image Prefix</FormLabel>
										<FormControl>
											<Input {...field} placeholder="Image Prefix" />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex flex-col gap-4  col-span-2">
							<FormField
								control={form.control}
								name="registryUrl"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Registry URL</FormLabel>
										<FormDescription>
											Enter only the hostname (e.g.,
											aws_account_id.dkr.ecr.us-west-2.amazonaws.com).
										</FormDescription>
										<FormControl>
											<Input
												placeholder="aws_account_id.dkr.ecr.us-west-2.amazonaws.com"
												{...field}
											/>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="col-span-2">
							<FormField
								control={form.control}
								name="runtimeWorkerId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Runtime worker (Optional)</FormLabel>
										<FormDescription>
											{runtimeWorkerId &&
											runtimeWorkerId !== "none" &&
											selectedRuntimeWorker ? (
												<>
													Authentication will be performed on{" "}
													<strong>{selectedRuntimeWorker.name}</strong>. This
													registry will be available on this runtime worker.
												</>
											) : (
												<>
													Choose where to authenticate with the registry. By
													default, authentication occurs on the local Docklands
													runtime. Select a specific worker to authenticate from
													that worker instead.
												</>
											)}
										</FormDescription>
										<FormControl>
											<Select
												aria-label="Registry authentication worker"
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<></>
												<>
													{deployWorkers && deployWorkers.length > 0 && (
														<Select.Group>
															<Select.GroupLabel>
																Runtime Workers
															</Select.GroupLabel>
															{deployWorkers.map((runtimeWorker) => (
																<Select.Option
																	key={runtimeWorker.runtimeWorkerId}
																	value={runtimeWorker.runtimeWorkerId}
																>
																	{runtimeWorker.name}
																</Select.Option>
															))}
														</Select.Group>
													)}
													{buildWorkers && buildWorkers.length > 0 && (
														<Select.Group>
															<Select.GroupLabel>
																Build Workers
															</Select.GroupLabel>
															{buildWorkers.map((runtimeWorker) => (
																<Select.Option
																	key={runtimeWorker.runtimeWorkerId}
																	value={runtimeWorker.runtimeWorkerId}
																>
																	{runtimeWorker.name}
																</Select.Option>
															))}
														</Select.Group>
													)}
													<Select.Group>
														<Select.Option value={"none"}>None</Select.Option>
													</Select.Group>
												</>
											</Select>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="flex flex-col w-full sm:justify-between gap-4 flex-wrap sm:flex-col col-span-2">
							<Dialog.Footer className="justify-between">
								<Button
									type="button"
									variant={"secondary"}
									loading={isPending || isPendingById}
									onClick={async () => {
										// When editing with empty password, use the existing password from DB
										if (registryId && (!password || password.length === 0)) {
											await testRegistryById({
												registryId: registryId || "",
												...(runtimeWorkerId && { runtimeWorkerId }),
											})
												.then((data) => {
													if (data) {
														toast.success("Registry Tested Successfully");
													} else {
														toast.error("Registry Test Failed");
													}
												})
												.catch((err) => {
													logger.error(err);
													toast.error("Error testing the registry");
												});
											return;
										}

										// When creating, password is required
										if (!registryId && (!password || password.length === 0)) {
											form.setError("password", {
												type: "manual",
												message: "Password is required",
											});
											return;
										}

										// When creating or editing with new password, validate and test with provided credentials
										const validationResult = AddRegistrySchema.safeParse({
											username,
											password,
											registryUrl,
											registryName: "Docklands Registry",
											imagePrefix,
											runtimeWorkerId,
											isEditing: !!registryId,
										});

										if (!validationResult.success) {
											for (const issue of validationResult.error.issues) {
												form.setError(issue.path[0] as any, {
													type: "manual",
													message: issue.message,
												});
											}
											return;
										}

										await testRegistry({
											username: username,
											password: password,
											registryUrl: registryUrl || "",
											registryName: registryName,
											registryType: "cloud",
											imagePrefix: imagePrefix,
											runtimeWorkerId: runtimeWorkerId,
										})
											.then((data) => {
												if (data) {
													toast.success("Registry Tested Successfully");
												} else {
													toast.error("Registry Test Failed");
												}
											})
											.catch((err) => {
												logger.error(err);
												toast.error("Error testing the registry");
											});
									}}
								>
									Test Registry
								</Button>
								<Button loading={form.formState.isSubmitting} type="submit">
									{registryId ? "Update" : "Create"}
								</Button>
							</Dialog.Footer>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
