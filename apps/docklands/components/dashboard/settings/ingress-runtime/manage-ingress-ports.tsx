import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { useHealthCheckAfterMutation } from "@/client/hooks/use-health-check-after-mutation";
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
import { ScrollArea } from "@/components/shared/scroll-area";
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";

interface Props {
	children: React.ReactNode;
	runtimeWorkerId?: string;
}

const PortSchema = z.object({
	targetPort: z.number().min(1, "Target port is required"),
	publishedPort: z.number().min(1, "Published port is required"),
	protocol: z.enum(["tcp", "udp", "sctp"]),
});

const IngressPortsSchema = z.object({
	ports: z.array(PortSchema),
});

type IngressPortsForm = z.infer<typeof IngressPortsSchema>;

export const ManageIngressPorts = ({ children, runtimeWorkerId }: Props) => {
	const [open, setOpen] = useState(false);

	const form = useForm<IngressPortsForm>({
		resolver: zodResolver(IngressPortsSchema),
		defaultValues: {
			ports: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "ports",
	});

	const { data: currentPorts, refetch: refetchPorts } =
		api.settings.getTraefikPorts.useQuery({
			runtimeWorkerId,
		});

	const { mutateAsync: updatePorts, isPending } =
		api.settings.updateTraefikPorts.useMutation();

	const {
		execute: executeWithHealthCheck,
		isExecuting: isHealthCheckExecuting,
	} = useHealthCheckAfterMutation({
		initialDelay: 5000,
		successMessage: "Ports updated successfully",
		onSuccess: () => {
			refetchPorts();
			setOpen(false);
		},
	});

	useEffect(() => {
		if (currentPorts) {
			form.reset({
				ports: currentPorts.map((port) => ({
					...port,
					protocol: port.protocol as "tcp" | "udp" | "sctp",
				})),
			});
		}
	}, [currentPorts, form]);

	const handleAddPort = () => {
		append({ targetPort: 0, publishedPort: 0, protocol: "tcp" });
	};

	const onSubmit = async (data: IngressPortsForm) => {
		try {
			await executeWithHealthCheck(() =>
				updatePorts({
					runtimeWorkerId,
					additionalPorts: data.ports,
				}),
			);
			setOpen(false);
		} catch (error) {
			toast.error((error as Error).message || "Error updating ingress ports");
		}
	};

	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				{children}
			</button>
			<Dialog.Root open={open} onOpenChange={setOpen}>
				<Dialog className="sm:max-w-3xl">
					<Dialog.Header>
						<Dialog.Title className="flex items-center gap-2 text-xl">
							Additional Port Mappings
						</Dialog.Title>
						<Dialog.Description className="text-base w-full">
							<div className="flex items-center justify-between">
								<div className="flex flex-col gap-1">
									Add or remove additional ports for the ingress runtime
									<span className="text-sm text-kumo-subtle">
										{fields.length} port mapping{fields.length !== 1 ? "s" : ""}{" "}
										configured
									</span>
								</div>
								<Button
									onClick={handleAddPort}
									variant="primary"
									className="gap-2"
								>
									<Plus className="h-4 w-4" />
									Add Mapping
								</Button>
							</div>
						</Dialog.Description>
					</Dialog.Header>

					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<div className="grid gap-6 py-4">
								{fields.length === 0 ? (
									<div className="flex w-full flex-col items-center justify-center gap-3 pt-10">
										<ArrowRightLeft className="size-8 text-kumo-subtle" />
										<span className="text-base text-kumo-subtle text-center">
											No port mappings configured
										</span>
										<p className="text-sm text-kumo-subtle text-center">
											Add one to get started
										</p>
									</div>
								) : (
									<ScrollArea className="pr-4">
										<div className="grid gap-4">
											{fields.map((field, index) => (
												<LayerCard key={field.id} className="bg-transparent">
													<div className="grid grid-cols-4  gap-4 p-4 transparent">
														<FormField
															control={form.control}
															name={`ports.${index}.targetPort`}
															render={({ field }) => (
																<FormItem>
																	<FormLabel className="text-sm font-medium text-kumo-subtle">
																		Target Port
																	</FormLabel>
																	<FormControl>
																		<Input
																			type="number"
																			{...field}
																			onChange={(e) => {
																				const value = e.target.value;
																				field.onChange(
																					value === ""
																						? undefined
																						: Number(value),
																				);
																			}}
																			value={field.value || ""}
																			placeholder="e.g. 8080"
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>

														<FormField
															control={form.control}
															name={`ports.${index}.publishedPort`}
															render={({ field }) => (
																<FormItem>
																	<FormLabel className="text-sm font-medium text-kumo-subtle">
																		Published Port
																	</FormLabel>
																	<FormControl>
																		<Input
																			type="number"
																			{...field}
																			onChange={(e) => {
																				const value = e.target.value;
																				field.onChange(
																					value === ""
																						? undefined
																						: Number(value),
																				);
																			}}
																			value={field.value || ""}
																			placeholder="e.g. 80"
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name={`ports.${index}.protocol`}
															render={({ field }) => (
																<FormItem>
																	<FormLabel className="text-sm font-medium text-kumo-subtle">
																		Protocol
																	</FormLabel>
																	<FormControl>
																		<Select
																			aria-label="Ingress port protocol"
																			onValueChange={field.onChange}
																			defaultValue={field.value}
																		>
																			<></>
																			<>
																				<Select.Group>
																					{["tcp", "udp", "sctp"].map(
																						(protocol) => (
																							<Select.Option
																								key={protocol}
																								value={protocol}
																							>
																								{protocol}
																							</Select.Option>
																						),
																					)}
																				</Select.Group>
																			</>
																		</Select>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>

														<div className="flex items-end">
															<Button
																aria-label="Remove port"
																onClick={() => remove(index)}
																variant="ghost"
																shape="square"
																className="text-kumo-subtle hover:text-kumo-danger"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</div>
												</LayerCard>
											))}
										</div>
									</ScrollArea>
								)}

								{fields.length > 0 && (
									<AlertBlock type="info">
										<div className="flex flex-col gap-2">
											<span className="text-sm">
												<strong>
													Each port mapping defines how external traffic reaches
													your containers through ingress.
												</strong>
												<ul className="pt-2">
													<li>
														<strong>Target Port:</strong> The port inside your
														container that the service is listening on.
													</li>
													<li>
														<strong>Published Port:</strong> The port on your
														host machine that will be mapped to the target port.
													</li>
												</ul>
												<p className="mt-2">
													All ports are bound directly to the host machine,
													allowing ingress to handle incoming traffic and route
													it appropriately to your services.
												</p>
											</span>
										</div>
									</AlertBlock>
								)}

								<AlertBlock type="warning">
									The ingress runtime container will be recreated from scratch.
									This means the container will be deleted and created again,
									which may cause downtime in your applications.
								</AlertBlock>
							</div>
							<Dialog.Footer>
								<Button
									type="submit"
									variant="primary"
									className="text-sm"
									loading={isPending || isHealthCheckExecuting}
								>
									Save
								</Button>
							</Dialog.Footer>
						</form>
					</Form>
				</Dialog>
			</Dialog.Root>
		</>
	);
};

export default ManageIngressPorts;
