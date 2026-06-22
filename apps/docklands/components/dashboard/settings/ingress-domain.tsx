import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { GlobeIcon } from "lucide-react";
import { useEffect } from "react";
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

const addServerDomain = z
	.object({
		domain: z.string().trim().toLowerCase(),
		letsEncryptEmail: z.string(),
		https: z.boolean().optional(),
		certificateType: z.enum(["letsencrypt", "none", "custom"]),
	})
	.superRefine((data, ctx) => {
		if (data.https && !data.certificateType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["certificateType"],
				message: "Required",
			});
		}
		if (
			data.https &&
			data.certificateType === "letsencrypt" &&
			!data.letsEncryptEmail
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"LetsEncrypt email is required when certificate type is letsencrypt",
				path: ["letsEncryptEmail"],
			});
		}
	});

type AddServerDomain = z.infer<typeof addServerDomain>;

export const IngressDomain = () => {
	const { data, refetch } = api.settings.getWebServerSettings.useQuery();
	const { mutateAsync, isPending } =
		api.settings.assignDomainServer.useMutation();

	const form = useForm<AddServerDomain>({
		defaultValues: {
			domain: "",
			certificateType: "none",
			letsEncryptEmail: "",
			https: false,
		},
		resolver: zodResolver(addServerDomain),
	});
	const https = form.watch("https");
	const domain = form.watch("domain") || "";
	const host = data?.host || "";
	const hasChanged = domain !== host;
	useEffect(() => {
		if (data) {
			form.reset({
				domain: data?.host || "",
				certificateType: data?.certificateType || "none",
				letsEncryptEmail: data?.letsEncryptEmail || "",
				https: data?.https || false,
			});
		}
	}, [form, form.reset, data]);

	const onSubmit = async (data: AddServerDomain) => {
		await mutateAsync({
			host: data.domain,
			letsEncryptEmail: data.letsEncryptEmail,
			certificateType: data.certificateType,
			https: data.https,
		})
			.then(async () => {
				await refetch();
				toast.success("Domain Assigned");
			})
			.catch(() => {
				toast.error("Error assigning the domain");
			});
	};

	return (
		<div className="w-full">
			<LayerCard className="h-full max-w-5xl mx-auto">
				<div className="flex flex-row gap-2 flex-wrap justify-between items-center">
					<div className="flex flex-col gap-1">
						<h3 className="text-xl flex flex-row gap-2">
							<GlobeIcon className="size-6 text-muted-foreground self-center" />
							Ingress Domain
						</h3>
						<p>Add a domain to the Docklands ingress.</p>
					</div>
				</div>
				<div className="space-y-2 py-6 border-t">
					{/* Warning for GitHub webhook URL changes */}
					{hasChanged && (
						<AlertBlock type="warning">
							<div className="space-y-2">
								<p className="font-medium">⚠️ Important: URL Change Impact</p>
								<p>
									If you change the Docklands ingress URL make sure to update
									your GitHub Apps to keep autobuilds and preview environments
									working.
								</p>
							</div>
						</AlertBlock>
					)}
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="grid w-full gap-4 grid-cols-2"
						>
							<FormField
								control={form.control}
								name="domain"
								render={({ field }) => {
									return (
										<FormItem className="col-span-2 md:col-span-1">
											<FormLabel>Domain</FormLabel>
											<FormControl>
												<Input
													className="w-full"
													placeholder={"docklands.example"}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									);
								}}
							/>

							<FormField
								control={form.control}
								name="letsEncryptEmail"
								render={({ field }) => {
									return (
										<FormItem className="col-span-2 md:col-span-1">
											<FormLabel>Let's Encrypt Email</FormLabel>
											<FormControl>
												<Input
													className="w-full"
													placeholder={"Dp4kz@example.com"}
													{...field}
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
									<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm w-full col-span-2">
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
							{https && (
								<FormField
									control={form.control}
									name="certificateType"
									render={({ field }) => {
										return (
											<FormItem className="col-span-2">
												<FormLabel>Certificate Provider</FormLabel>
												<Select
													aria-label="Ingress certificate provider"
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<></>
													</FormControl>
													<>
														<Select.Option value={"none"}>None</Select.Option>
														<Select.Option value={"letsencrypt"}>
															Let's Encrypt
														</Select.Option>
													</>
												</Select>
												<FormMessage />
											</FormItem>
										);
									}}
								/>
							)}

							<div className="flex w-full justify-end col-span-2">
								<Button loading={isPending} type="submit">
									Save
								</Button>
							</div>
						</form>
					</Form>
				</div>
			</LayerCard>
		</div>
	);
};
