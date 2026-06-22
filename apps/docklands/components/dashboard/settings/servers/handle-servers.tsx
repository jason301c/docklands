import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Pencil, PlusIcon } from "lucide-react";
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

const Schema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	description: z.string().optional(),
	ipAddress: z.string().min(1, {
		message: "IP Address is required",
	}),
	port: z.number().optional(),
	username: z.string().optional(),
	sshKeyId: z.string().min(1, {
		message: "SSH Key is required",
	}),
	serverType: z.enum(["deploy", "build"]).default("deploy"),
	enableDockerCleanup: z.boolean().default(true),
});

type Schema = z.infer<typeof Schema>;

interface Props {
	serverId?: string;
	asButton?: boolean;
}

export const HandleServers = ({ serverId, asButton = false }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { data, refetch: refetchServer } = api.server.one.useQuery(
		{
			serverId: serverId || "",
		},
		{
			enabled: !!serverId,
		},
	);

	const { data: sshKeys } = api.sshKey.all.useQuery();
	const { mutateAsync, error, isPending, isError } = serverId
		? api.server.update.useMutation()
		: api.server.create.useMutation();
	const form = useForm({
		defaultValues: {
			description: "",
			name: "",
			ipAddress: "",
			port: 22,
			username: "root",
			sshKeyId: "",
			serverType: "deploy",
			enableDockerCleanup: true,
		},
		resolver: zodResolver(Schema),
	});

	useEffect(() => {
		form.reset({
			description: data?.description || "",
			name: data?.name || "",
			ipAddress: data?.ipAddress || "",
			port: data?.port || 22,
			username: data?.username || "root",
			sshKeyId: data?.sshKeyId || "",
			serverType: data?.serverType || "deploy",
			enableDockerCleanup: data?.enableDockerCleanup ?? true,
		});
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	const onSubmit = async (data: Schema) => {
		await mutateAsync({
			name: data.name,
			description: data.description || "",
			ipAddress: data.ipAddress?.trim() || "",
			port: data.port || 22,
			username: data.username || "root",
			sshKeyId: data.sshKeyId || "",
			serverType: data.serverType || "deploy",
			enableDockerCleanup: data.enableDockerCleanup,
			serverId: serverId || "",
		})
			.then(async (_data) => {
				await utils.server.all.invalidate();
				refetchServer();
				toast.success(serverId ? "Worker updated" : "Worker created");
				setIsOpen(false);
			})
			.catch(() => {
				toast.error(
					serverId ? "Error updating a worker" : "Error creating a worker",
				);
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			{serverId ? (
				asButton ? (
					<Dialog.Trigger
						render={
							<Button
								aria-label="Edit server"
								variant="outline"
								shape="square"
								className="h-9 w-9"
							>
								<Pencil className="h-4 w-4" />
							</Button>
						}
					/>
				) : (
					<DropdownMenu.Item
						className="w-full cursor-pointer "
						onSelect={(e) => {
							e.preventDefault();
							setIsOpen(true);
						}}
					>
						Edit Worker
					</DropdownMenu.Item>
				)
			) : (
				<Dialog.Trigger
					render={
						<Button className="cursor-pointer space-x-3">
							<PlusIcon className="h-4 w-4" />
							Create Worker
						</Button>
					}
				/>
			)}
			<Dialog className="sm:max-w-3xl ">
				<div>
					<Dialog.Title>
						{serverId ? "Edit" : "Create"} Runtime Worker
					</Dialog.Title>
					<Dialog.Description>
						{serverId ? "Edit" : "Create"} a worker to run deployments on a
						remote machine.
					</Dialog.Description>
				</div>
				<div>
					<p className="text-primary text-sm font-medium">
						Use any VPS or machine that supports SSH and a Docker-compatible
						Linux environment.
					</p>
					<AlertBlock className="mt-4 px-4">
						Docklands needs passwordless sudo for non-root SSH users when it
						installs or updates worker dependencies.
					</AlertBlock>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-server"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4 ">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder="Melbourne Worker" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="This worker is for databases..."
											className="resize-none"
											{...field}
										/>
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="serverType"
							render={({ field }) => {
								const serverTypeValue = form.watch("serverType");
								return (
									<FormItem>
										<FormLabel>Worker Role</FormLabel>
										<Select
											aria-label="Worker role"
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<Select.Group>
												<Select.Option value="deploy">
													Deploy Worker
												</Select.Option>
												<Select.Option value="build">
													Build Worker
												</Select.Option>
												<Select.GroupLabel>Worker Role</Select.GroupLabel>
											</Select.Group>
										</Select>
										<FormMessage />
										{serverTypeValue === "deploy" && (
											<AlertBlock type="info" className="mt-2">
												Deploy workers are used to run your applications,
												databases, and services. They handle the deployment and
												execution of your projects.
											</AlertBlock>
										)}
										{serverTypeValue === "build" && (
											<AlertBlock type="info" className="mt-2">
												Build workers are dedicated to building your
												applications. They handle the compilation and build
												process, offloading this work from your deployment
												workers. Build workers won't appear in deployment
												options.
											</AlertBlock>
										)}
									</FormItem>
								);
							}}
						/>
						<FormField
							control={form.control}
							name="sshKeyId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Select a SSH Key</FormLabel>
									<Select
										aria-label="SSH key"
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<></>
										<>
											<Select.Group>
												{sshKeys?.map((sshKey) => (
													<Select.Option
														key={sshKey.sshKeyId}
														value={sshKey.sshKeyId}
													>
														{sshKey.name}
													</Select.Option>
												))}
												<Select.GroupLabel>
													Registries ({sshKeys?.length})
												</Select.GroupLabel>
											</Select.Group>
										</>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="ipAddress"
								render={({ field }) => (
									<FormItem>
										<FormLabel>IP Address</FormLabel>
										<FormControl>
											<Input placeholder="192.168.1.100" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="port"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Port</FormLabel>
										<FormControl>
											<Input
												placeholder="22"
												{...field}
												onChange={(e) => {
													const value = e.target.value;
													if (value === "") {
														field.onChange(0);
													} else {
														const number = Number.parseInt(value, 10);
														if (!Number.isNaN(number)) {
															field.onChange(number);
														}
													}
												}}
											/>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<Input placeholder="root" {...field} />
									</FormControl>
									<FormDescription>
										Use &quot;root&quot; or a non-root user with passwordless
										sudo access.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="enableDockerCleanup"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel>Enable Runtime Cleanup</FormLabel>
										<FormDescription>
											Automatically prune unused container images daily. Keeps
											disk usage in check on this runtime worker.
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
					</form>

					<div>
						<Button
							loading={isPending}
							form="hook-form-add-server"
							type="submit"
						>
							{serverId ? "Update" : "Create"}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
