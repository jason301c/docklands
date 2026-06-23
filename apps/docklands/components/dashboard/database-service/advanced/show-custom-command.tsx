import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("database-service");

const addDockerImage = z.object({
	dockerImage: z.string().min(1, "Docker image is required"),
	command: z.string(),
	args: z
		.array(
			z.object({
				value: z.string().min(1, "Argument cannot be empty"),
			}),
		)
		.optional(),
});

interface Props {
	id: string;
	type: "postgres" | "mysql" | "mariadb" | "mongo" | "redis" | "libsql";
}

type AddDockerImage = z.infer<typeof addDockerImage>;
export const ShowCustomCommand = ({ id, type }: Props) => {
	const { data, refetch } = api.database.one.useQuery(
		{ databaseId: id },
		{ enabled: !!id },
	);
	const { mutateAsync } = api.database.update.useMutation();

	const form = useForm<AddDockerImage>({
		defaultValues: {
			dockerImage: "",
			command: "",
			args: [],
		},
		resolver: zodResolver(addDockerImage),
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "args",
	});

	useEffect(() => {
		if (data) {
			form.reset({
				dockerImage: data.dockerImage,
				command: data.command || "",
				args: data.args?.map((arg: string) => ({ value: arg })) || [],
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: AddDockerImage) => {
		await mutateAsync({
			databaseId: id,
			dockerImage: formData?.dockerImage,
			command: formData?.command,
			args: formData?.args?.map((arg) => arg.value).filter(Boolean),
		})
			.then(async () => {
				toast.success("Custom Command Updated");
				await refetch();
			})
			.catch((err) => {
				logger.error("Error updating the custom command", err);
				toast.error("Error updating the custom command");
			});
	};
	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<LayerCard className="bg-kumo-canvas">
					<div>
						<h3 className="text-xl font-semibold">Advanced Settings</h3>
					</div>
					<div className="flex flex-col gap-4">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="grid w-full gap-4 "
							>
								<div className="grid w-full gap-4">
									<FormField
										control={form.control}
										name="dockerImage"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Container Image</FormLabel>
												<FormControl>
													<Input placeholder="postgres:18" {...field} />
												</FormControl>

												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<FormField
									control={form.control}
									name="command"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Command</FormLabel>
											<FormControl>
												<Input
													placeholder={
														type === "libsql"
															? "sqld --db-path iku.db --http-listen-addr 0.0.0.0:8080 --grpc-listen-addr 0.0.0.0:5001 --admin-listen-addr 0.0.0.0:5000"
															: "Custom command"
													}
													{...field}
												/>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<FormLabel>Arguments (Args)</FormLabel>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => append({ value: "" })}
										>
											<Plus className="h-4 w-4 mr-1" />
											Add Argument
										</Button>
									</div>

									{fields.length === 0 && (
										<p className="text-sm text-kumo-subtle">
											No arguments added yet. Click "Add Argument" to add one.
										</p>
									)}

									{fields.map((field, index) => (
										<FormField
											key={field.id}
											control={form.control}
											name={`args.${index}.value`}
											render={({ field }) => (
												<FormItem>
													<div className="flex gap-2">
														<FormControl>
															<Input
																placeholder={
																	index === 0
																		? "-c"
																		: "redis-server --port 6379"
																}
																{...field}
															/>
														</FormControl>
														<Button
															aria-label="Remove command argument"
															type="button"
															variant="destructive"
															shape="square"
															onClick={() => remove(index)}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
													<FormMessage />
												</FormItem>
											)}
										/>
									))}
								</div>

								<div className="flex w-full justify-end">
									<Button loading={form.formState.isSubmitting} type="submit">
										Save
									</Button>
								</div>
							</form>
						</Form>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
