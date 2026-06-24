import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("application");

const AddPortSchema = z.object({
	publishedPort: z.number().int().min(1).max(65535),
	publishMode: z.enum(["ingress", "host"]),
	targetPort: z.number().int().min(1).max(65535),
	protocol: z.enum(["tcp", "udp"]),
});

type AddPort = z.infer<typeof AddPortSchema>;

interface Props {
	applicationId: string;
	portId?: string;
	children?: React.ReactNode;
}

export const HandlePorts = ({
	applicationId,
	portId,
	children = <PlusIcon className="h-4 w-4" />,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();

	const { data } = api.port.one.useQuery(
		{
			portId: portId ?? "",
		},
		{
			enabled: !!portId,
		},
	);
	const updatePort = api.port.update.useMutation();
	const createPort = api.port.create.useMutation();
	const { mutateAsync, isPending, error, isError } = portId
		? updatePort
		: createPort;

	const form = useForm<AddPort>({
		defaultValues: {
			publishedPort: 0,
			targetPort: 0,
		},
		resolver: zodResolver(AddPortSchema),
	});

	const publishMode = useWatch({
		control: form.control,
		name: "publishMode",
	});

	useEffect(() => {
		form.reset({
			publishedPort: data?.publishedPort ?? 0,
			publishMode: data?.publishMode ?? "ingress",
			targetPort: data?.targetPort ?? 0,
			protocol: data?.protocol ?? "tcp",
		});
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	const onSubmit = async (data: AddPort) => {
		await mutateAsync({
			applicationId,
			...data,
			portId: portId || "",
		})
			.then(async () => {
				toast.success(portId ? "Port Updated" : "Port Created");
				await utils.application.one.invalidate({
					applicationId,
				});
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error(
					portId ? "Failed to update the port" : "Failed to create the port",
					err,
				);
				toast.error(
					portId ? "Error updating the port" : "Error creating the port",
				);
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					portId ? (
						<Button
							aria-label="Edit port"
							variant="ghost"
							shape="square"
							className="group hover:bg-kumo-brand/10 "
						>
							<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
						</Button>
					) : (
						((<Button>{children}</Button>) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-lg">
				<Dialog.Header>
					<Dialog.Title>Ports</Dialog.Title>
					<Dialog.Description>
						Ports are used to expose your application to the internet.
					</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-add-port"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="publishedPort"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Published Port</FormLabel>
										<FormControl>
											<Input
												placeholder="1-65535"
												{...field}
												value={field.value?.toString() || ""}
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
							<FormField
								control={form.control}
								name="publishMode"
								render={({ field }) => {
									return (
										<FormItem className="md:col-span-2">
											<FormLabel>Published Port Mode</FormLabel>
											<Select
												aria-label="Published port mode"
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<></>
												</FormControl>
												<>
													<Select.Option value={"ingress"}>
														Ingress
													</Select.Option>
													<Select.Option value={"host"}>Host</Select.Option>
												</>
											</Select>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
							<FormField
								control={form.control}
								name="targetPort"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Target Port</FormLabel>
										<FormControl>
											<Input
												placeholder="1-65535"
												{...field}
												value={field.value?.toString() || ""}
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
							<FormField
								control={form.control}
								name="protocol"
								render={({ field }) => {
									return (
										<FormItem className="md:col-span-2">
											<FormLabel>Protocol</FormLabel>
											<Select
												aria-label="Port protocol"
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<></>
												</FormControl>
												<>
													<Select.Option value={"tcp"}>TCP</Select.Option>
													<Select.Option value={"udp"}>UDP</Select.Option>
												</>
											</Select>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
						</div>
					</form>

					{publishMode === "host" && (
						<AlertBlock type="warning" className="mt-4">
							<strong>Host Mode Limitation:</strong> When using Host publish
							mode, orchestration has limitations that prevent proper container
							updates during builds. Old containers may not be replaced
							automatically. Consider using Ingress mode instead, or be prepared
							to manually stop/start the application after builds.
						</AlertBlock>
					)}

					<Dialog.Footer>
						<Button loading={isPending} form="hook-form-add-port" type="submit">
							{portId ? "Update" : "Create"}
						</Button>
					</Dialog.Footer>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
