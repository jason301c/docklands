import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Hammer } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	Form,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

interface Props {
	applicationId: string;
}

const schema = z
	.object({
		buildServerId: z.string().optional(),
		buildRegistryId: z.string().optional(),
	})
	.refine(
		(data) => {
			// Both empty/none is valid
			const buildServerIsNone =
				!data.buildServerId || data.buildServerId === "none";
			const buildRegistryIsNone =
				!data.buildRegistryId || data.buildRegistryId === "none";

			// Both should be either filled or empty
			if (buildServerIsNone && buildRegistryIsNone) return true;
			if (!buildServerIsNone && !buildRegistryIsNone) return true;

			return false;
		},
		{
			message:
				"Both Build Worker and Build Registry must be selected together, or both set to None",
			path: ["buildServerId"],
		},
	);

type Schema = z.infer<typeof schema>;

export const ShowBuildWorker = ({ applicationId }: Props) => {
	const { data, refetch } = api.application.one.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);
	const { data: buildWorkers } = api.runtimeWorker.buildServers.useQuery();
	const { data: registries } = api.registry.all.useQuery();

	const { mutateAsync, isPending } = api.application.update.useMutation();

	const form = useForm<Schema>({
		defaultValues: {
			buildServerId: data?.buildServerId || "",
			buildRegistryId: data?.buildRegistryId || "",
		},
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				buildServerId: data?.buildServerId || "",
				buildRegistryId: data?.buildRegistryId || "",
			});
		}
	}, [form, form.reset, data]);

	const onSubmit = async (formData: Schema) => {
		await mutateAsync({
			applicationId,
			buildServerId:
				formData?.buildServerId === "none" || !formData?.buildServerId
					? null
					: formData?.buildServerId,
			buildRegistryId:
				formData?.buildRegistryId === "none" || !formData?.buildRegistryId
					? null
					: formData?.buildRegistryId,
		})
			.then(async () => {
				toast.success("Build worker settings updated");
				await refetch();
			})
			.catch(() => {
				toast.error("Error updating build worker settings");
			});
	};

	return (
		<LayerCard className="bg-background">
			<div>
				<div className="flex flex-row items-center gap-2">
					<Hammer className="size-6 text-muted-foreground" />
					<div>
						<h3 className="text-xl">Build Worker</h3>
						<p>Configure a dedicated worker for building your application.</p>
					</div>
				</div>
			</div>
			<div className="flex flex-col gap-4">
				<AlertBlock type="info">
					Build workers offload image creation from your runtime workers. Select
					a build worker and registry to use for building your application.
				</AlertBlock>

				<AlertBlock type="info">
					📊 <strong>Important:</strong> Once the build finishes, you'll need to
					wait a few seconds for the runtime worker to download the image. These
					download logs will <strong>NOT</strong> appear in the build logs.
					Check the <strong>Logs</strong> tab to see when the container starts
					running.
				</AlertBlock>

				<AlertBlock type="info">
					<strong>Note:</strong> Build Worker and Build Registry must be
					configured together. You can either select both or set both to None.
				</AlertBlock>

				{!registries || registries.length === 0 ? (
					<AlertBlock type="warning">
						You need to add at least one registry to use build workers. Please
						go to{" "}
						<Link
							href="/dashboard/settings/image-registry"
							className="text-primary underline"
						>
							Image Registry
						</Link>{" "}
						to add a registry.
					</AlertBlock>
				) : null}

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="buildServerId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Build Worker</FormLabel>
									<Select
										aria-label="Build worker"
										onValueChange={(value) => {
											if (value === null) return;
											field.onChange(value);
											if (value === "none") {
												form.setValue("buildRegistryId", "none");
											}
										}}
										value={field.value || "none"}
									>
										<Select.Group>
											<Select.Option value="none">
												<span className="flex items-center gap-2">
													<span>None</span>
												</span>
											</Select.Option>
											{buildWorkers?.map((server) => (
												<Select.Option
													key={server.serverId}
													value={server.serverId}
												>
													<span className="flex items-center gap-2 justify-between w-full">
														<span>{server.name}</span>
														<span className="text-muted-foreground text-xs">
															{server.ipAddress}
														</span>
													</span>
												</Select.Option>
											))}
											<Select.GroupLabel>
												Build Workers ({buildWorkers?.length || 0})
											</Select.GroupLabel>
										</Select.Group>
									</Select>
									<FormDescription>
										Select a build worker to handle the build process for this
										application.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="buildRegistryId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Build Registry</FormLabel>
									<Select
										aria-label="Build registry"
										onValueChange={(value) => {
											if (value === null) return;
											field.onChange(value);
											if (value === "none") {
												form.setValue("buildServerId", "none");
											}
										}}
										value={field.value || "none"}
									>
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
									</Select>
									<FormDescription>
										Select a registry to store the built images from the build
										worker.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex w-full justify-end">
							<Button loading={isPending} type="submit">
								Save
							</Button>
						</div>
					</form>
				</Form>
			</div>
		</LayerCard>
	);
};
