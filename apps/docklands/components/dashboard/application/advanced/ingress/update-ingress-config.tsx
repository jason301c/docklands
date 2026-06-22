import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Label } from "@cloudflare/kumo/components/label";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { parse, stringify, YAMLParseError } from "yaml";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const UpdateIngressConfigSchema = z.object({
	traefikConfig: z.string(),
});

type UpdateIngressConfig = z.infer<typeof UpdateIngressConfigSchema>;

interface Props {
	applicationId: string;
}

export const validateAndFormatYAML = (yamlText: string) => {
	try {
		const obj = parse(yamlText);
		const formattedYaml = stringify(obj, { indent: 4 });
		return { valid: true, formattedYaml, error: null };
	} catch (error) {
		if (error instanceof YAMLParseError) {
			return {
				valid: false,
				formattedYaml: yamlText,
				error: error.message,
			};
		}
		return {
			valid: false,
			formattedYaml: yamlText,
			error: "An unexpected error occurred while processing the YAML.",
		};
	}
};

export const UpdateIngressConfig = ({ applicationId }: Props) => {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canWrite = permissions?.traefikFiles.write ?? false;
	const [open, setOpen] = useState(false);
	const [skipYamlValidation, setSkipYamlValidation] = useState(false);
	const { data, refetch } = api.application.readTraefikConfig.useQuery(
		{
			applicationId,
		},
		{ enabled: !!applicationId },
	);

	const { mutateAsync, isPending, error, isError } =
		api.application.updateTraefikConfig.useMutation();

	const form = useForm<UpdateIngressConfig>({
		defaultValues: {
			traefikConfig: "",
		},
		resolver: zodResolver(UpdateIngressConfigSchema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				traefikConfig: data || "",
			});
		}
	}, [data]);

	const onSubmit = async (data: UpdateIngressConfig) => {
		if (!skipYamlValidation) {
			const { valid, error } = validateAndFormatYAML(data.traefikConfig);
			if (!valid) {
				form.setError("traefikConfig", {
					type: "manual",
					message: (error as string) || "Invalid YAML",
				});
				return;
			}
		}
		form.clearErrors("traefikConfig");
		await mutateAsync({
			applicationId,
			traefikConfig: data.traefikConfig,
		})
			.then(async () => {
				toast.success("Ingress config updated");
				refetch();
				setOpen(false);
				form.reset();
			})
			.catch(() => {
				toast.error("Error updating the ingress config");
			});
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(open) => {
				setOpen(open);
				if (!open) {
					form.reset();
					setSkipYamlValidation(false);
				}
			}}
		>
			{canWrite && (
				<Dialog.Trigger render={<Button loading={isPending}>Modify</Button>} />
			)}
			<Dialog className="sm:max-w-4xl">
				<div>
					<Dialog.Title>Update ingress config</Dialog.Title>
					<Dialog.Description>
						Update the service ingress config
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-update-ingress-config"
						onSubmit={form.handleSubmit(onSubmit)}
						className="w-full space-y-4 overflow-auto"
					>
						<div className="flex flex-col">
							<FormField
								control={form.control}
								name="traefikConfig"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Ingress config</FormLabel>
										<FormControl>
											<CodeEditor
												lineWrapping
												wrapperClassName="h-[35rem] font-mono"
												placeholder={`http:
routers:
    router-name:
        rule: Host('domain.com')
        service: container-name
        entryPoints:
            - web
        tls: false
        middlewares: []
                                                    `}
												{...field}
											/>
										</FormControl>

										<pre>
											<FormMessage />
										</pre>
									</FormItem>
								)}
							/>
						</div>
					</form>

					<div className="flex-col sm:flex-row gap-4">
						<div className="flex flex-col gap-1 w-full sm:w-auto sm:mr-auto">
							<div className="flex items-center space-x-2">
								<Checkbox
									checked={skipYamlValidation}
									onCheckedChange={(checked) =>
										setSkipYamlValidation(checked === true)
									}
								/>
								<Label
									htmlFor="skip-yaml-validation-app"
									className="text-sm font-normal cursor-pointer"
								>
									Skip YAML validation (for Go templating)
								</Label>
							</div>
							<p className="text-sm text-muted-foreground">
								Check to save configs with Go templating (e.g.{" "}
								<code className="text-xs">{"{{range}}"}</code>).
							</p>
						</div>
						<Button
							loading={isPending}
							form="hook-form-update-ingress-config"
							type="submit"
						>
							Update
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
