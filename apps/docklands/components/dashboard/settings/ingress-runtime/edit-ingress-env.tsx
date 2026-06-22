import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { useHealthCheckAfterMutation } from "@/client/hooks/use-health-check-after-mutation";
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

const schema = z.object({
	env: z.string(),
});

type Schema = z.infer<typeof schema>;

interface Props {
	children?: React.ReactNode;
	serverId?: string;
}

export const EditIngressEnv = ({ children, serverId }: Props) => {
	const [canEdit, setCanEdit] = useState(true);

	const { data } = api.settings.readTraefikEnv.useQuery({
		serverId,
	});

	const { mutateAsync, isPending, error, isError } =
		api.settings.writeTraefikEnv.useMutation();

	const {
		execute: executeWithHealthCheck,
		isExecuting: isHealthCheckExecuting,
	} = useHealthCheckAfterMutation({
		initialDelay: 5000,
		successMessage: "Ingress environment updated",
	});

	const form = useForm<Schema>({
		defaultValues: {
			env: data || "",
		},
		disabled: canEdit,
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				env: data || "",
			});
		}
	}, [form, form.reset, data]);

	const onSubmit = async (data: Schema) => {
		try {
			await executeWithHealthCheck(() =>
				mutateAsync({
					env: data.env,
					serverId,
				}),
			);
		} catch {
			toast.error("Error updating the ingress environment");
		}
	};

	// Add keyboard shortcut for Ctrl+S/Cmd+S
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				(e.ctrlKey || e.metaKey) &&
				e.code === "KeyS" &&
				!isPending &&
				!canEdit
			) {
				e.preventDefault();
				form.handleSubmit(onSubmit)();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [form, onSubmit, isPending, canEdit]);

	return (
		<Dialog.Root>
			<Dialog.Trigger render={children as never} />
			<Dialog className="sm:max-w-4xl">
				<div>
					<Dialog.Title>Update Ingress Environment</Dialog.Title>
					<Dialog.Description>
						Update ingress runtime environment variables
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-update-ingress-env"
						onSubmit={form.handleSubmit(onSubmit)}
						className="w-full space-y-4 relative overflow-auto"
					>
						<div className="flex flex-col">
							<FormField
								control={form.control}
								name="env"
								render={({ field }) => (
									<FormItem className="relative">
										<FormLabel>Env</FormLabel>
										<FormControl>
											<CodeEditor
												language="properties"
												wrapperClassName="h-[35rem] font-mono"
												placeholder={`TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=test@localhost.com
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_STORAGE=/etc/docklands/traefik/dynamic/acme.json
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_HTTP_CHALLENGE=true
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_HTTP_CHALLENGE_PRETTY=true
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_HTTP_CHALLENGE_ENTRYPOINT=web
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_HTTP_CHALLENGE_DNS_CHALLENGE=true
TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_HTTP_CHALLENGE_DNS_PROVIDER=cloudflare
                                                    `}
												{...field}
											/>
										</FormControl>

										<pre>
											<FormMessage />
										</pre>
										<div className="flex justify-end absolute z-50 right-6 top-0">
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
						</div>
					</form>

					<div>
						<Button
							loading={isPending || isHealthCheckExecuting}
							disabled={canEdit || isPending || isHealthCheckExecuting}
							form="hook-form-update-ingress-env"
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
