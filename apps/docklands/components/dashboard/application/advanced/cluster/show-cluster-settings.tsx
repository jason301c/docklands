import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Server } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { AddSwarmSettings } from "./modify-swarm-settings";

const logger = createClientLogger("application");

interface Props {
	id: string;
	type: "application" | "mariadb" | "mongo" | "mysql" | "postgres" | "redis";
}

const AddRedirectSchema = z.object({
	replicas: z.number().min(1, "Replicas must be at least 1"),
	registryId: z.string().optional(),
});

type AddCommand = z.infer<typeof AddRedirectSchema>;

export const ShowClusterSettings = ({ id, type }: Props) => {
	const queryMap = {
		application: () =>
			api.application.one.useQuery({ applicationId: id }, { enabled: !!id }),
		mariadb: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		mongo: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		mysql: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		postgres: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		redis: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
	};
	const { data, refetch } = queryMap[type]
		? queryMap[type]()
		: api.database.one.useQuery({ databaseId: id }, { enabled: !!id });
	const { data: registries } = api.registry.all.useQuery();

	const mutationMap = {
		application: () => api.application.update.useMutation(),
		libsql: () => api.database.update.useMutation(),
		mariadb: () => api.database.update.useMutation(),
		mongo: () => api.database.update.useMutation(),
		mysql: () => api.database.update.useMutation(),
		postgres: () => api.database.update.useMutation(),
		redis: () => api.database.update.useMutation(),
	};

	const { mutateAsync, isPending } = mutationMap[type]
		? mutationMap[type]()
		: api.database.update.useMutation();

	const form = useForm<AddCommand>({
		defaultValues: {
			...(type === "application" && data && "registryId" in data
				? {
						registryId: data?.registryId || "",
					}
				: {}),
			replicas: data?.replicas || 1,
		},
		resolver: zodResolver(AddRedirectSchema),
	});

	useEffect(() => {
		if (data?.command) {
			form.reset({
				...(type === "application" && data && "registryId" in data
					? {
							registryId: data?.registryId || "",
						}
					: {}),
				replicas: data?.replicas || 1,
			});
		}
	}, [form, form.reset, form.formState.isSubmitSuccessful, data?.command]);

	const onSubmit = async (data: AddCommand) => {
		await mutateAsync({
			applicationId: id || "",
			databaseId: id,
			...(type === "application"
				? {
						registryId:
							data?.registryId === "none" || !data?.registryId
								? null
								: data?.registryId,
					}
				: {}),
			replicas: data?.replicas,
		})
			.then(async () => {
				toast.success("Orchestration settings updated");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to update orchestration settings", err);
				toast.error("Error updating orchestration settings");
			});
	};

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row justify-between">
				<div>
					<h3 className="text-xl font-semibold">Orchestration Settings</h3>
					<p>Control how this service is scheduled across runtime workers.</p>
				</div>
				<AddSwarmSettings id={id} type={type} />
			</div>
			<div className="flex flex-col gap-4">
				<AlertBlock type="info">
					Run a build after modifying orchestration settings to apply the
					changes.
				</AlertBlock>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="replicas"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Replicas</FormLabel>
										<FormControl>
											<Input
												placeholder="1"
												{...field}
												onChange={(e) => {
													const value = e.target.value;
													field.onChange(value === "" ? 0 : Number(value));
												}}
												type="number"
												value={field.value || ""}
											/>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{type === "application" && (
							<>
								{registries && registries?.length === 0 ? (
									<div className="pt-10">
										<div className="flex flex-col items-center gap-3">
											<Server className="size-8 text-kumo-subtle" />
											<span className="text-base text-kumo-subtle">
												To use multi-worker orchestration, configure at least
												one registry first. Go to{" "}
												<Link
													href="/dashboard/settings/image-registry"
													className="text-kumo-default"
												>
													Image Registry
												</Link>{" "}
												to do so.
											</span>
										</div>
									</div>
								) : (
									<>
										<FormField
											control={form.control}
											name="registryId"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Select a registry</FormLabel>
													<Select
														aria-label="Cluster image registry"
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<Select.Group>
															{registries?.map((registry) => (
																<Select.Option
																	key={registry.registryId}
																	value={registry.registryId}
																>
																	{registry.registryName}
																</Select.Option>
															))}
															<Select.Option value={"none"}>None</Select.Option>
															<Select.GroupLabel>
																Registries ({registries?.length})
															</Select.GroupLabel>
														</Select.Group>
													</Select>
												</FormItem>
											)}
										/>
									</>
								)}
							</>
						)}

						<div className="flex justify-end">
							<Button loading={isPending} type="submit" className="w-fit">
								Save
							</Button>
						</div>
					</form>
				</Form>
			</div>
		</LayerCard>
	);
};
