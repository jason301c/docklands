import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { HelpCircle, Plus, Settings2, X } from "lucide-react";
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
import { Secrets } from "@/components/shared/secrets";
import { toast } from "@/components/shared/toast";

const schema = z
	.object({
		env: z.string(),
		buildArgs: z.string(),
		buildSecrets: z.string(),
		wildcardDomain: z.string(),
		port: z.number(),
		previewLimit: z.number(),
		previewLabels: z.array(z.string()).optional(),
		previewHttps: z.boolean(),
		previewPath: z.string(),
		previewCertificateType: z.enum(["letsencrypt", "none", "custom"]),
		previewCustomCertResolver: z.string().optional(),
		previewRequireCollaboratorPermissions: z.boolean(),
	})
	.superRefine((input, ctx) => {
		if (
			input.previewCertificateType === "custom" &&
			!input.previewCustomCertResolver
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["previewCustomCertResolver"],
				message: "Required",
			});
		}
	});

type Schema = z.infer<typeof schema>;

interface Props {
	applicationId: string;
}

export const ShowPreviewSettings = ({ applicationId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [isEnabled, setIsEnabled] = useState(false);
	const { mutateAsync: updateApplication, isPending } =
		api.application.update.useMutation();

	const { data, refetch } = api.application.one.useQuery({ applicationId });

	const form = useForm<Schema>({
		defaultValues: {
			env: "",
			wildcardDomain: "*.sslip.io",
			port: 3000,
			previewLimit: 3,
			previewLabels: [],
			previewHttps: false,
			previewPath: "/",
			previewCertificateType: "none",
			previewRequireCollaboratorPermissions: true,
		},
		resolver: zodResolver(schema),
	});

	const previewHttps = form.watch("previewHttps");
	const wildcardDomain = form.watch("wildcardDomain");
	const isTraefikMeDomain = wildcardDomain?.includes("sslip.io") || false;

	useEffect(() => {
		setIsEnabled(data?.isPreviewDeploymentsActive || false);
	}, [data?.isPreviewDeploymentsActive]);

	useEffect(() => {
		if (data) {
			form.reset({
				env: data.previewEnv || "",
				buildArgs: data.previewBuildArgs || "",
				buildSecrets: data.previewBuildSecrets || "",
				wildcardDomain: data.previewWildcard || "*.sslip.io",
				port: data.previewPort || 3000,
				previewLabels: data.previewLabels || [],
				previewLimit: data.previewLimit || 3,
				previewHttps: data.previewHttps || false,
				previewPath: data.previewPath || "/",
				previewCertificateType: data.previewCertificateType || "none",
				previewCustomCertResolver: data.previewCustomCertResolver || "",
				previewRequireCollaboratorPermissions:
					data.previewRequireCollaboratorPermissions ?? true,
			});
		}
	}, [data]);

	const onSubmit = async (formData: Schema) => {
		updateApplication({
			previewEnv: formData.env,
			previewBuildArgs: formData.buildArgs,
			previewBuildSecrets: formData.buildSecrets,
			previewWildcard: formData.wildcardDomain,
			previewPort: formData.port,
			previewLabels: formData.previewLabels,
			applicationId,
			previewLimit: formData.previewLimit,
			previewHttps: formData.previewHttps,
			previewPath: formData.previewPath,
			previewCertificateType: formData.previewCertificateType,
			previewCustomCertResolver: formData.previewCustomCertResolver,
			previewRequireCollaboratorPermissions:
				formData.previewRequireCollaboratorPermissions,
		})
			.then(() => {
				toast.success("Preview environment settings updated");
			})
			.catch((error) => {
				toast.error(error.message);
			});
	};
	return (
		<div>
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<Dialog.Trigger
					render={
						<Button variant="outline">
							<Settings2 className="size-4" />
							Configure
						</Button>
					}
				/>
				<Dialog className="sm:max-w-5xl w-full">
					<div>
						<Dialog.Title>Preview Environment Settings</Dialog.Title>
						<Dialog.Description>
							Adjust pull request environments for this application, including
							environment variables, build options, and build rules.
						</Dialog.Description>
					</div>
					<div className="grid gap-4">
						{isTraefikMeDomain && (
							<AlertBlock type="info">
								<strong>Note:</strong> sslip.io is a public HTTP service and
								does not support SSL/HTTPS. HTTPS and certificate options will
								not have any effect.
							</AlertBlock>
						)}
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								id="hook-form-delete-application"
								className="grid w-full gap-4"
							>
								<div className="grid gap-4 lg:grid-cols-2">
									<FormField
										control={form.control}
										name="wildcardDomain"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Wildcard Domain</FormLabel>
												<FormControl>
													<Input placeholder="*.sslip.io" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="previewPath"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Preview URL Path</FormLabel>
												<FormControl>
													<Input placeholder="/" {...field} />
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
													<Input type="number" placeholder="3000" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="previewLabels"
										render={({ field }) => (
											<FormItem className="md:col-span-2">
												<div className="flex items-center gap-2">
													<FormLabel>Pull Request Labels</FormLabel>
													<TooltipProvider>
														<Tooltip
															content={
																<>
																	<p>
																		Add labels that can create a preview
																		environment for a pull request. If none are
																		specified, all pull requests can create one.
																	</p>
																</>
															}
															asChild
														>
															<HelpCircle className="size-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
														</Tooltip>
													</TooltipProvider>
												</div>
												<div className="flex flex-wrap gap-2 mb-2">
													{field.value?.map((label, index) => (
														<Badge
															key={index}
															variant="secondary"
															className="flex items-center gap-1"
														>
															{label}
															<X
																className="size-3 cursor-pointer hover:text-destructive"
																onClick={() => {
																	const newLabels = [...(field.value || [])];
																	newLabels.splice(index, 1);
																	field.onChange(newLabels);
																}}
															/>
														</Badge>
													))}
												</div>
												<div className="flex gap-2">
													<FormControl>
														<Input
															placeholder="Enter a label (e.g. enhancements, needs-review)"
															onKeyDown={(e) => {
																if (e.key === "Enter") {
																	e.preventDefault();
																	const input = e.currentTarget;
																	const label = input.value.trim();
																	if (label) {
																		field.onChange([
																			...(field.value || []),
																			label,
																		]);
																		input.value = "";
																	}
																}
															}}
														/>
													</FormControl>
													<Button
														aria-label="Add preview label"
														type="button"
														variant="outline"
														shape="square"
														onClick={() => {
															const input = document.querySelector(
																'input[placeholder*="Enter a label"]',
															) as HTMLInputElement;
															const label = input.value.trim();
															if (label) {
																field.onChange([...(field.value || []), label]);
																input.value = "";
															}
														}}
													>
														<Plus className="size-4" />
													</Button>
												</div>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="previewLimit"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Environment Limit</FormLabel>
												<FormControl>
													<Input type="number" placeholder="3000" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="previewHttps"
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
									{previewHttps && (
										<FormField
											control={form.control}
											name="previewCertificateType"
											render={({ field }) => (
												<FormItem>
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
															<Select.Option value={"custom"}>
																Custom
															</Select.Option>
														</>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
									)}

									{form.watch("previewCertificateType") === "custom" && (
										<FormField
											control={form.control}
											name="previewCustomCertResolver"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Certificate Provider</FormLabel>
													<FormControl>
														<Input
															placeholder="my-custom-resolver"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									)}
								</div>
								<div className="grid gap-4 lg:grid-cols-2">
									<div className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-2">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												Enable preview environments
											</FormLabel>
											<FormDescription>
												Enable or disable pull request environments for this
												application.
											</FormDescription>
										</div>
										<Switch
											checked={isEnabled}
											onCheckedChange={(checked) => {
												updateApplication({
													isPreviewDeploymentsActive: checked,
													applicationId,
												})
													.then(() => {
														refetch();
														toast.success(
															checked
																? "Preview environments enabled"
																: "Preview environments disabled",
														);
													})
													.catch((error) => {
														toast.error(error.message);
													});
											}}
										/>
									</div>
								</div>

								<div className="grid gap-4 lg:grid-cols-2">
									<FormField
										control={form.control}
										name="previewRequireCollaboratorPermissions"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm col-span-2">
												<div className="space-y-0.5">
													<FormLabel>
														Require Collaborator Permissions
													</FormLabel>
													<FormDescription>
														Require collaborator permissions to create preview
														environments. Valid roles are:
														<ul>
															<li>Admin</li>
															<li>Maintain</li>
															<li>Write</li>
														</ul>
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
								</div>

								<FormField
									control={form.control}
									name="env"
									render={() => (
										<FormItem>
											<FormControl>
												<Secrets
													name="env"
													title="Environment Settings"
													description="You can add environment variables to your resource."
													placeholder={[
														"NODE_ENV=production",
														"PORT=3000",
													].join("\n")}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								{data?.buildType === "dockerfile" && (
									<Secrets
										name="buildArgs"
										title="Build-time Arguments"
										description={
											<span>
												Arguments are available only at build-time. See
												documentation&nbsp;
												<a
													className="text-primary"
													href="https://docs.docker.com/build/building/variables/"
													target="_blank"
													rel="noopener noreferrer"
												>
													here
												</a>
												.
											</span>
										}
										placeholder="NPM_TOKEN=xyz"
									/>
								)}
								{data?.buildType === "dockerfile" && (
									<Secrets
										name="buildSecrets"
										title="Build-time Secrets"
										description={
											<span>
												Secrets are specially designed for sensitive information
												and are only available at build-time. See
												documentation&nbsp;
												<a
													className="text-primary"
													href="https://docs.docker.com/build/building/secrets/"
													target="_blank"
													rel="noopener noreferrer"
												>
													here
												</a>
												.
											</span>
										}
										placeholder="NPM_TOKEN=xyz"
									/>
								)}
							</form>
						</Form>
					</div>
					<div>
						<Button
							variant="secondary"
							onClick={() => {
								setIsOpen(false);
							}}
						>
							Cancel
						</Button>
						<Button
							loading={isPending}
							form="hook-form-delete-application"
							type="submit"
						>
							Save
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
			{/* */}
		</div>
	);
};
