import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Dices } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type z from "zod";
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
import { domain } from "@/server/core/db/validations/domain";

type Domain = z.infer<typeof domain>;

interface Props {
	previewDeploymentId: string;
	domainId?: string;
	children: React.ReactNode;
}

export const AddPreviewDomain = ({
	previewDeploymentId,
	domainId = "",
	children,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();
	const { data, refetch } = api.domain.one.useQuery(
		{
			domainId,
		},
		{
			enabled: !!domainId,
		},
	);

	const { data: previewDeployment } = api.previewDeployment.one.useQuery(
		{
			previewDeploymentId,
		},
		{
			enabled: !!previewDeploymentId,
		},
	);

	const { mutateAsync, isError, error, isPending } = domainId
		? api.domain.update.useMutation()
		: api.domain.create.useMutation();

	const { mutateAsync: generateDomain, isPending: isLoadingGenerate } =
		api.domain.generateDomain.useMutation();

	const form = useForm<Domain>({
		resolver: zodResolver(domain),
	});

	const host = form.watch("host");
	const isTraefikMeDomain = host?.includes("sslip.io") || false;

	useEffect(() => {
		if (data) {
			form.reset({
				...data,
				/* Convert null to undefined */
				path: data?.path || undefined,
				port: data?.port || undefined,
				customCertResolver: data?.customCertResolver || undefined,
			});
		}

		if (!domainId) {
			form.reset({});
		}
	}, [form, form.reset, data, isPending]);

	const dictionary = {
		success: domainId ? "Domain Updated" : "Domain Created",
		error: domainId ? "Error updating the domain" : "Error creating the domain",
		submit: domainId ? "Update" : "Create",
		dialogDescription: domainId
			? "In this section you can edit a domain"
			: "In this section you can add domains",
	};

	const onSubmit = async (data: Domain) => {
		await mutateAsync({
			domainId,
			previewDeploymentId,
			...data,
		})
			.then(async () => {
				toast.success(dictionary.success);
				await utils.previewDeployment.all.invalidate({
					applicationId: previewDeployment?.applicationId,
				});

				if (domainId) {
					refetch();
				}
				setIsOpen(false);
			})
			.catch(() => {
				toast.error(dictionary.error);
			});
	};
	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger className="" render={children as never} />
			<Dialog className="sm:max-w-2xl">
				<div>
					<Dialog.Title>Domain</Dialog.Title>
					<Dialog.Description>
						{dictionary.dialogDescription}
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-8 "
					>
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<FormField
									control={form.control}
									name="host"
									render={({ field }) => (
										<FormItem>
											{isTraefikMeDomain && (
												<AlertBlock type="info">
													<strong>Note:</strong> sslip.io is a public HTTP
													service and does not support SSL/HTTPS. HTTPS and
													certificate options will not have any effect.
												</AlertBlock>
											)}
											<FormLabel>Host</FormLabel>
											<div className="flex gap-2">
												<FormControl>
													<Input
														placeholder="api.docklands.example"
														{...field}
													/>
												</FormControl>
												<TooltipProvider delay={0}>
													<Tooltip
														content={
															<>
																<p>Generate sslip.io domain</p>
															</>
														}
														side="left"
														className="max-w-[10rem]"
														asChild
													>
														<Button
															variant="secondary"
															type="button"
															loading={isLoadingGenerate}
															onClick={() => {
																generateDomain({
																	appName: previewDeployment?.appName || "",
																	runtimeWorkerId:
																		previewDeployment?.application
																			?.runtimeWorkerId || "",
																})
																	.then((domain) => {
																		field.onChange(domain);
																	})
																	.catch((err) => {
																		toast.error(err.message);
																	});
															}}
														>
															<Dices className="size-4 text-kumo-subtle" />
														</Button>
													</Tooltip>
												</TooltipProvider>
											</div>

											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="path"
									render={({ field }) => {
										return (
											<FormItem>
												<FormLabel>Path</FormLabel>
												<FormControl>
													<Input
														placeholder={"/"}
														{...field}
														value={field.value ?? ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										);
									}}
								/>

								<FormField
									control={form.control}
									name="port"
									render={({ field }) => {
										return (
											<FormItem>
												<FormLabel>Container Port</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder={"3000"}
														{...field}
														value={field.value ?? ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										);
									}}
								/>

								<FormField
									control={form.control}
									name="https"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm">
											<div className="space-y-0.5">
												<FormLabel>HTTPS</FormLabel>
												<FormDescription>
													Automatically provision SSL Certificate.
												</FormDescription>
												<FormMessage />
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

								{form.getValues().https && (
									<FormField
										control={form.control}
										name="certificateType"
										render={({ field }) => (
											<FormItem className="col-span-2">
												<FormLabel>Certificate Provider</FormLabel>
												<Select
													aria-label="Preview certificate provider"
													onValueChange={field.onChange}
													defaultValue={field.value || ""}
												>
													<FormControl>
														<></>
													</FormControl>

													<>
														<Select.Option value="none">None</Select.Option>
														<Select.Option value={"letsencrypt"}>
															Let's Encrypt
														</Select.Option>
													</>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
							</div>
						</div>
					</form>

					<div>
						<Button loading={isPending} form="hook-form" type="submit">
							{dictionary.submit}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
