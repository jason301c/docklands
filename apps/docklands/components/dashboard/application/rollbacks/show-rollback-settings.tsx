import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
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

const formSchema = z
	.object({
		rollbackActive: z.boolean(),
		rollbackRegistryId: z.string().optional(),
	})
	.superRefine((values, ctx) => {
		if (
			values.rollbackActive &&
			(!values.rollbackRegistryId || values.rollbackRegistryId === "none")
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["rollbackRegistryId"],
				message: "Registry is required when rollbacks are enabled",
			});
		}
	});

type FormValues = z.infer<typeof formSchema>;

interface Props {
	applicationId: string;
	children?: React.ReactNode;
}

export const ShowRollbackSettings = ({ applicationId, children }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const { data: application, refetch } = api.application.one.useQuery(
		{
			applicationId,
		},
		{
			enabled: !!applicationId,
		},
	);

	const { mutateAsync: updateApplication, isPending } =
		api.application.update.useMutation();

	const { data: registries } = api.registry.all.useQuery();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			rollbackActive: application?.rollbackActive ?? false,
			rollbackRegistryId: application?.rollbackRegistryId || "",
		},
	});

	useEffect(() => {
		if (application) {
			form.reset({
				rollbackActive: application.rollbackActive ?? false,
				rollbackRegistryId: application.rollbackRegistryId || "",
			});
		}
	}, [application, form]);

	const onSubmit = async (data: FormValues) => {
		await updateApplication({
			applicationId,
			rollbackActive: data.rollbackActive,
			rollbackRegistryId:
				data.rollbackRegistryId === "none" || !data.rollbackRegistryId
					? null
					: data.rollbackRegistryId,
		})
			.then(() => {
				toast.success("Rollback settings updated");
				setIsOpen(false);
				refetch();
			})
			.catch(() => {
				toast.error("Failed to update rollback settings");
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger render={children as never} />
			<Dialog>
				<div>
					<Dialog.Title>Rollback Settings</Dialog.Title>
					<Dialog.Description>
						Configure how rollbacks work for this application
					</Dialog.Description>
					<AlertBlock>
						Having rollbacks enabled increases storage usage. Be careful with
						this option. Note that manually cleaning the cache may delete
						rollback images, making them unavailable for future rollbacks.
					</AlertBlock>
				</div>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<FormField
							control={form.control}
							name="rollbackActive"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel className="text-base">
											Enable Rollbacks
										</FormLabel>
										<FormDescription>
											Allow rolling back to previous builds
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

						{form.watch("rollbackActive") && (
							<FormField
								control={form.control}
								name="rollbackRegistryId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Rollback Registry</FormLabel>
										<Select
											aria-label="Rollback registry"
											onValueChange={field.onChange}
											value={field.value || "none"}
										>
											<FormControl>
												<></>
											</FormControl>
											<>
												<Select.Group>
													<Select.Option value="none">
														<span className="flex items-center gap-2">
															<span>None</span>
														</span>
													</Select.Option>
													{registries?.map((registry) => (
														<Select.Option
															key={registry.registryId}
															value={registry.registryId}
														>
															{registry.registryName}
														</Select.Option>
													))}
													<Select.GroupLabel>
														Registries ({registries?.length || 0})
													</Select.GroupLabel>
												</Select.Group>
											</>
										</Select>
										{!registries || registries.length === 0 ? (
											<FormDescription className="text-amber-600 dark:text-amber-500">
												No registries available. Please{" "}
												<Link
													href="/dashboard/settings/image-registry"
													className="underline font-medium hover:text-amber-700 dark:hover:text-amber-400"
												>
													configure a registry
												</Link>{" "}
												first to enable rollbacks.
											</FormDescription>
										) : (
											<FormDescription>
												Select a registry where rollback images will be stored.
											</FormDescription>
										)}
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<Button
							type="submit"
							className="w-full justify-center"
							loading={isPending}
						>
							Save Settings
						</Button>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
