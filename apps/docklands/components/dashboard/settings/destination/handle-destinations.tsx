import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, PlusIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import {
	ADDITIONAL_FLAG_ERROR,
	ADDITIONAL_FLAG_REGEX,
} from "@/server/core/db/validations/destination";
import { cn } from "@/shared/utils";
import { S3_PROVIDERS } from "./constants";

const addDestination = z.object({
	name: z.string().min(1, "Name is required"),
	provider: z.string().min(1, "Provider is required"),
	accessKeyId: z.string().min(1, "Access Key Id is required"),
	secretAccessKey: z.string().min(1, "Secret Access Key is required"),
	bucket: z.string().min(1, "Bucket is required"),
	region: z.string(),
	endpoint: z.string().min(1, "Endpoint is required"),
	serverId: z.string().optional(),
	additionalFlags: z
		.array(
			z.object({
				value: z
					.string()
					.min(1, "Flag cannot be empty")
					.regex(ADDITIONAL_FLAG_REGEX, ADDITIONAL_FLAG_ERROR),
			}),
		)
		.optional(),
});

type AddDestination = z.infer<typeof addDestination>;

interface Props {
	destinationId?: string;
}

export const HandleDestinations = ({ destinationId }: Props) => {
	const [open, setOpen] = useState(false);
	const utils = api.useUtils();
	const { data: servers } = api.server.withSSHKey.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();

	const { mutateAsync, isError, error, isPending } = destinationId
		? api.destination.update.useMutation()
		: api.destination.create.useMutation();

	const { data: destination } = api.destination.one.useQuery(
		{
			destinationId: destinationId || "",
		},
		{
			enabled: !!destinationId,
			refetchOnWindowFocus: false,
		},
	);
	const {
		mutateAsync: testConnection,
		isPending: isPendingConnection,
		error: connectionError,
		isError: isErrorConnection,
	} = api.destination.testConnection.useMutation();

	const form = useForm<AddDestination>({
		defaultValues: {
			provider: "",
			accessKeyId: "",
			bucket: "",
			name: "",
			region: "",
			secretAccessKey: "",
			endpoint: "",
			additionalFlags: [],
		},
		resolver: zodResolver(addDestination),
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "additionalFlags",
	});

	useEffect(() => {
		if (destination) {
			form.reset({
				name: destination.name,
				provider: destination.provider || "",
				accessKeyId: destination.accessKey,
				secretAccessKey: destination.secretAccessKey,
				bucket: destination.bucket,
				region: destination.region,
				endpoint: destination.endpoint,
				additionalFlags:
					destination.additionalFlags?.map((f) => ({ value: f })) ?? [],
			});
		} else {
			form.reset();
		}
	}, [form, form.reset, form.formState.isSubmitSuccessful, destination]);

	const onSubmit = async (data: AddDestination) => {
		await mutateAsync({
			provider: data.provider || "",
			accessKey: data.accessKeyId,
			bucket: data.bucket,
			endpoint: data.endpoint,
			name: data.name,
			region: data.region,
			secretAccessKey: data.secretAccessKey,
			destinationId: destinationId || "",
			additionalFlags: data.additionalFlags?.map((f) => f.value) ?? [],
		})
			.then(async () => {
				toast.success(`Destination ${destinationId ? "Updated" : "Created"}`);
				await utils.destination.all.invalidate();
				if (destinationId) {
					await utils.destination.one.invalidate({ destinationId });
				}
				setOpen(false);
			})
			.catch((e) => {
				toast.error(
					`Error ${destinationId ? "Updating" : "Creating"} the Destination`,
					{
						description: e.message,
					},
				);
			});
	};

	const handleTestConnection = async (serverId?: string) => {
		const result = await form.trigger([
			"provider",
			"accessKeyId",
			"secretAccessKey",
			"bucket",
			"endpoint",
			"additionalFlags",
		]);

		if (!result) {
			const errors = form.formState.errors;
			const errorFields = Object.entries(errors)
				.map(([field, error]) => `${field}: ${error?.message}`)
				.filter(Boolean)
				.join("\n");

			toast.error("Please fill all required fields", {
				description: errorFields,
			});
			return;
		}

		if (isCloud && !serverId) {
			toast.error("Please select a server");
			return;
		}

		const provider = form.getValues("provider");
		const accessKey = form.getValues("accessKeyId");
		const secretKey = form.getValues("secretAccessKey");
		const bucket = form.getValues("bucket");
		const endpoint = form.getValues("endpoint");
		const region = form.getValues("region");

		const connectionString = `:s3,provider=${provider},access_key_id=${accessKey},secret_access_key=${secretKey},endpoint=${endpoint}${region ? `,region=${region}` : ""}:${bucket}`;

		await testConnection({
			provider,
			accessKey,
			bucket,
			endpoint,
			name: "Test",
			region,
			secretAccessKey: secretKey,
			serverId,
			additionalFlags:
				form.getValues("additionalFlags")?.map((f) => f.value) ?? [],
		})
			.then(() => {
				toast.success("Connection Success");
			})
			.catch((e) => {
				toast.error("Error connecting to provider", {
					description: `${e.message}\n\nTry manually: rclone ls ${connectionString}`,
				});
			});
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				className=""
				render={
					destinationId ? (
						<Button
							aria-label="Edit destination"
							variant="ghost"
							shape="square"
							className="group hover:bg-blue-500/10 "
						>
							<PenBoxIcon className="size-3.5  text-primary group-hover:text-blue-500" />
						</Button>
					) : (
						((
							<Button className="cursor-pointer space-x-3">
								<PlusIcon className="h-4 w-4" />
								Add Destination
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<div>
					<Dialog.Title>
						{destinationId ? "Update" : "Add"} Destination
					</Dialog.Title>
					<Dialog.Description>
						In this section, you can configure and add new destinations for your
						backups. Please ensure that you provide the correct information to
						guarantee secure and efficient storage.
					</Dialog.Description>
				</div>
				{(isError || isErrorConnection) && (
					<AlertBlock type="error" className="w-full">
						{connectionError?.message || error?.message}
					</AlertBlock>
				)}

				<Form {...form}>
					<form
						id="hook-form-destination-add"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4 "
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder={"S3 Bucket"} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								);
							}}
						/>
						<FormField
							control={form.control}
							name="provider"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Provider</FormLabel>
										<FormControl>
											<Select
												aria-label="Select option"
												onValueChange={field.onChange}
												defaultValue={field.value}
												value={field.value}
											>
												<FormControl>
													<></>
												</FormControl>
												<>
													{S3_PROVIDERS.map((s3Provider) => (
														<Select.Option
															key={s3Provider.key}
															value={s3Provider.key}
														>
															{s3Provider.name}
														</Select.Option>
													))}
												</>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								);
							}}
						/>

						<FormField
							control={form.control}
							name="accessKeyId"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Access Key Id</FormLabel>
										<FormControl>
											<Input placeholder={"xcas41dasde"} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								);
							}}
						/>
						<FormField
							control={form.control}
							name="secretAccessKey"
							render={({ field }) => (
								<FormItem>
									<div className="space-y-0.5">
										<FormLabel>Secret Access Key</FormLabel>
									</div>
									<FormControl>
										<Input placeholder={"asd123asdasw"} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="bucket"
							render={({ field }) => (
								<FormItem>
									<div className="space-y-0.5">
										<FormLabel>Bucket</FormLabel>
									</div>
									<FormControl>
										<Input placeholder={"docklands-bucket"} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="region"
							render={({ field }) => (
								<FormItem>
									<div className="space-y-0.5">
										<FormLabel>Region</FormLabel>
									</div>
									<FormControl>
										<Input placeholder={"us-east-1"} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="endpoint"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Endpoint</FormLabel>
									<FormControl>
										<Input
											placeholder={"https://us.bucket.aws/s3"}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<FormLabel>Additional Flags (Optional)</FormLabel>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => append({ value: "" })}
								>
									<PlusIcon className="size-4" />
									Add Flag
								</Button>
							</div>
							{fields.map((field, index) => (
								<FormField
									key={field.id}
									control={form.control}
									name={`additionalFlags.${index}.value`}
									render={({ field }) => (
										<FormItem>
											<div className="flex items-center gap-2">
												<FormControl>
													<Input
														placeholder="--s3-sign-accept-encoding=false"
														{...field}
													/>
												</FormControl>
												<Button
													aria-label="Remove destination option"
													type="button"
													variant="ghost"
													shape="square"
													onClick={() => remove(index)}
												>
													<Trash2 className="size-4 text-muted-foreground" />
												</Button>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							))}
						</div>
					</form>

					<div
						className={cn(
							isCloud ? "!flex-col" : "flex-row",
							"flex w-full  !justify-between gap-4",
						)}
					>
						{isCloud ? (
							<div className="flex flex-col gap-4 border p-2 rounded-lg">
								<span className="text-sm text-muted-foreground">
									Select a runtime worker to test the destination. If you do not
									have a worker, use automatic placement.
								</span>
								<FormField
									control={form.control}
									name="serverId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Runtime Worker (Optional)</FormLabel>
											<FormControl>
												<Select
													aria-label="Select option"
													onValueChange={field.onChange}
													defaultValue={field.value}
												>
													<></>
													<>
														<Select.Group>
															<Select.GroupLabel>Servers</Select.GroupLabel>
															{servers?.map((server) => (
																<Select.Option
																	key={server.serverId}
																	value={server.serverId}
																>
																	{server.name}
																</Select.Option>
															))}
															<Select.Option value={"none"}>None</Select.Option>
														</Select.Group>
													</>
												</Select>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								<Button
									type="button"
									variant={"secondary"}
									loading={isPendingConnection}
									onClick={async () => {
										await handleTestConnection(form.getValues("serverId"));
									}}
								>
									Test Connection
								</Button>
							</div>
						) : (
							<Button
								loading={isPendingConnection}
								type="button"
								variant="secondary"
								onClick={async () => {
									await handleTestConnection();
								}}
							>
								Test connection
							</Button>
						)}

						<Button
							loading={isPending}
							form="hook-form-destination-add"
							type="submit"
						>
							{destinationId ? "Update" : "Create"}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
