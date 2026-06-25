import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Switch } from "@cloudflare/kumo/components/switch";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { SectionCard } from "@/components/shared/section-card";
import { Select } from "@/components/shared/select";

const logger = createClientLogger("ingress-domain");

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
		defaultIngressMode: z.enum(["public", "tunnel"]),
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
	const {
		mutateAsync: updateDefaultIngressMode,
		isPending: isUpdatingDefaultIngressMode,
	} = api.settings.updateDefaultIngressMode.useMutation();

	const form = useForm<AddServerDomain>({
		defaultValues: {
			domain: "",
			certificateType: "none",
			letsEncryptEmail: "",
			https: false,
			defaultIngressMode: "public",
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
				defaultIngressMode: data?.defaultIngressMode || "public",
			});
		}
	}, [form, form.reset, data]);

	const onSubmit = async (data: AddServerDomain) => {
		await Promise.all([
			mutateAsync({
				host: data.domain,
				letsEncryptEmail: data.letsEncryptEmail,
				certificateType: data.certificateType,
				https: data.https,
			}),
			updateDefaultIngressMode({
				defaultIngressMode: data.defaultIngressMode,
			}),
		])
			.then(async () => {
				await refetch();
				toast.success("Ingress settings saved");
			})
			.catch((err) => {
				logger.error(err);
				toast.error("Error saving ingress settings");
			});
	};

	return (
		<SectionCard title="Ingress Domain" contentClassName="space-y-2">
			{/* Warning for GitHub webhook URL changes */}
			{hasChanged && (
				<AlertBlock type="warning">
					<div className="space-y-2">
						<p className="font-medium">⚠️ Important: URL Change Impact</p>
						<p>
							If you change the Docklands ingress URL make sure to update your
							GitHub Apps to keep autobuilds and preview environments working.
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
										<FormControl>
											<Select
												aria-label="Ingress certificate provider"
												onValueChange={field.onChange}
												value={field.value}
											>
												<Select.Option value={"none"}>None</Select.Option>
												<Select.Option value={"letsencrypt"}>
													Let's Encrypt
												</Select.Option>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								);
							}}
						/>
					)}

					<FormField
						control={form.control}
						name="defaultIngressMode"
						render={({ field }) => (
							<FormItem className="col-span-2">
								<FormLabel>Default Domain Ingress</FormLabel>
								<FormControl>
									<Select
										aria-label="Default domain ingress mode"
										onValueChange={field.onChange}
										value={field.value}
									>
										<Select.Option value="public">Public</Select.Option>
										<Select.Option value="tunnel">
											Cloudflare Tunnel
										</Select.Option>
									</Select>
								</FormControl>
								<FormDescription>
									New domains use this mode unless a service chooses another
									ingress mode.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex w-full justify-end col-span-2">
						<Button
							loading={isPending || isUpdatingDefaultIngressMode}
							type="submit"
						>
							Save
						</Button>
					</div>
				</form>
			</Form>
		</SectionCard>
	);
};
