import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Label } from "@cloudflare/kumo/components/label";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
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
import { validateAndFormatYAML } from "../application/advanced/ingress/update-ingress-config";

const UpdateIngressFileConfigSchema = z.object({
	traefikConfig: z.string(),
});

type UpdateIngressFileConfig = z.infer<typeof UpdateIngressFileConfigSchema>;

interface Props {
	path: string;
	runtimeWorkerId?: string;
}

export const ShowIngressFile = ({ path, runtimeWorkerId }: Props) => {
	const {
		data,
		refetch,
		isLoading: isLoadingFile,
	} = api.settings.readTraefikFile.useQuery(
		{
			path,
			runtimeWorkerId,
		},
		{
			enabled: !!path,
		},
	);
	const [canEdit, setCanEdit] = useState(true);
	const [skipYamlValidation, setSkipYamlValidation] = useState(false);

	const { mutateAsync, isPending, error, isError } =
		api.settings.updateTraefikFile.useMutation();

	const form = useForm<UpdateIngressFileConfig>({
		defaultValues: {
			traefikConfig: "",
		},
		disabled: canEdit,
		resolver: zodResolver(UpdateIngressFileConfigSchema),
	});

	useEffect(() => {
		form.reset({
			traefikConfig: data || "",
		});
	}, [form, form.reset, data]);

	const onSubmit = async (data: UpdateIngressFileConfig) => {
		if (!skipYamlValidation) {
			const { valid, error } = validateAndFormatYAML(data.traefikConfig);
			if (!valid) {
				form.setError("traefikConfig", {
					type: "manual",
					message: error || "Invalid YAML",
				});
				return;
			}
		}
		form.clearErrors("traefikConfig");
		await mutateAsync({
			traefikConfig: data.traefikConfig,
			path,
			runtimeWorkerId,
		})
			.then(async () => {
				toast.success("Ingress config updated");
				refetch();
			})
			.catch(() => {
				toast.error("Error updating ingress config");
			});
	};

	return (
		<div>
			{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="w-full relative z-[5]"
				>
					<div className="flex flex-col overflow-auto">
						{isLoadingFile ? (
							<div className="w-full flex-col gap-2 flex items-center justify-center h-[55vh]">
								<span className="text-muted-foreground text-lg font-medium">
									Loading...
								</span>
								<Loader2 className="animate-spin size-8 text-muted-foreground" />
							</div>
						) : (
							<FormField
								control={form.control}
								name="traefikConfig"
								render={({ field }) => (
									<FormItem className="relative">
										<FormLabel>Ingress config</FormLabel>
										<FormDescription className="break-all">
											{path}
										</FormDescription>
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
										<div className="flex justify-end absolute z-50 right-6 top-8">
											<Button
												className="shadow-sm"
												variant="secondary"
												type="button"
												onClick={async () => {
													setCanEdit(!canEdit);
												}}
											>
												{canEdit ? "Unlock" : "Lock"}
											</Button>
										</div>
									</FormItem>
								)}
							/>
						)}
					</div>
					<div className="flex flex-col gap-4">
						<div className="flex items-center space-x-2">
							<Checkbox
								checked={skipYamlValidation}
								onCheckedChange={(checked) =>
									setSkipYamlValidation(checked === true)
								}
							/>
							<Label
								htmlFor="skip-yaml-validation"
								className="text-sm font-normal cursor-pointer"
							>
								Skip YAML validation (for Go templating)
							</Label>
						</div>
						<p className="text-sm text-muted-foreground -mt-2">
							Traefik supports Go templating in dynamic configs (e.g.{" "}
							<code className="text-xs">{"{{range}}"}</code>). Configs using
							templates will fail standard YAML validation. Check this to save
							without validation.
						</p>
						<div className="flex justify-end">
							<Button
								loading={isPending}
								disabled={canEdit || isLoadingFile}
								type="submit"
							>
								Update
							</Button>
						</div>
					</div>
				</form>
			</Form>
		</div>
	);
};
