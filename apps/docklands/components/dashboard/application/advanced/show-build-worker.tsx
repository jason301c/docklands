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
import { createClientLogger } from "@/client/lib/logger";
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

const logger = createClientLogger("application");

interface Props {
	applicationId: string;
}

const schema = z
	.object({
		buildRuntimeWorkerId: z.string().optional(),
		buildRegistryId: z.string().optional(),
	})
	.refine(
		(data) => {
			// Both empty/none is valid
			const buildServerIsNone =
				!data.buildRuntimeWorkerId || data.buildRuntimeWorkerId === "none";
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
			path: ["buildRuntimeWorkerId"],
		},
	);

type Schema = z.infer<typeof schema>;

export const ShowBuildWorker = ({ applicationId }: Props) => {
	const { data, refetch } = api.application.one.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);
	const { data: buildWorkers } = api.runtimeWorker.buildWorkers.useQuery();
	const { data: registries } = api.registry.all.useQuery();

	const { mutateAsync, isPending } = api.application.update.useMutation();

	const form = useForm<Schema>({
		defaultValues: {
			buildRuntimeWorkerId: data?.buildRuntimeWorkerId || "",
			buildRegistryId: data?.buildRegistryId || "",
		},
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				buildRuntimeWorkerId: data?.buildRuntimeWorkerId || "",
				buildRegistryId: data?.buildRegistryId || "",
			});
		}
	}, [form, form.reset, data]);

	const onSubmit = async (formData: Schema) => {
		await mutateAsync({
			applicationId,
			buildRuntimeWorkerId:
				formData?.buildRuntimeWorkerId === "none" ||
				!formData?.buildRuntimeWorkerId
					? null
					: formData?.buildRuntimeWorkerId,
			buildRegistryId:
				formData?.buildRegistryId === "none" || !formData?.buildRegistryId
					? null
					: formData?.buildRegistryId,
		})
			.then(async () => {
				toast.success("Build worker settings updated");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to update build worker settings", err);
				toast.error("Error updating build worker settings");
			});
	};

	return (
		<LayerCard className="bg-kumo-canvas">
			<div>
				<div className="flex flex-row items-center gap-2">
					<Hammer className="size-6 text-kumo-subtle" />
					<div>
						<h3 className="text-xl font-semibold">Build Worker</h3>
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
							className="text-kumo-brand underline"
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
							name="buildRuntimeWorkerId"
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
											{buildWorkers?.map((runtimeWorker) => (
												<Select.Option
													key={runtimeWorker.runtimeWorkerId}
													value={runtimeWorker.runtimeWorkerId}
												>
													<span className="flex items-center gap-2 justify-between w-full">
														<span>{runtimeWorker.name}</span>
														<span className="text-kumo-subtle text-xs">
															{runtimeWorker.ipAddress}
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
												form.setValue("buildRuntimeWorkerId", "none");
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
