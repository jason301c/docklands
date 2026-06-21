import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
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
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";

const DockerProviderSchema = z.object({
	externalPort: z.preprocess((a) => {
		if (a === null || a === undefined || a === "") return null;
		const parsed = Number.parseInt(String(a), 10);
		return Number.isNaN(parsed) ? null : parsed;
	}, z
		.number()
		.gte(0, "Range must be 0 - 65535")
		.lte(65535, "Range must be 0 - 65535")
		.nullable()),
	externalGRPCPort: z.preprocess((a) => {
		if (a === null || a === undefined || a === "") return null;
		const parsed = Number.parseInt(String(a), 10);
		return Number.isNaN(parsed) ? null : parsed;
	}, z
		.number()
		.gte(0, "Range must be 0 - 65535")
		.lte(65535, "Range must be 0 - 65535")
		.nullable()),
	externalAdminPort: z.preprocess((a) => {
		if (a === null || a === undefined || a === "") return null;
		const parsed = Number.parseInt(String(a), 10);
		return Number.isNaN(parsed) ? null : parsed;
	}, z
		.number()
		.gte(0, "Range must be 0 - 65535")
		.lte(65535, "Range must be 0 - 65535")
		.nullable()),
});

type DockerProvider = z.infer<typeof DockerProviderSchema>;

interface Props {
	libsqlId: string;
}
export const ShowExternalLibsqlCredentials = ({ libsqlId }: Props) => {
	const { data: ip } = api.settings.getIp.useQuery();
	const { data, refetch } = api.libsql.one.useQuery({ libsqlId });
	const { mutateAsync, isPending } = api.libsql.saveExternalPorts.useMutation();
	const [connectionUrl, setConnectionUrl] = useState("");
	const [connectionGRPCUrl, setGRPCConnectionUrl] = useState("");
	const getIp = data?.server?.ipAddress || ip;

	const form = useForm({
		defaultValues: {},
		resolver: zodResolver(DockerProviderSchema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				externalPort: data.externalPort,
				externalGRPCPort: data.externalGRPCPort,
				externalAdminPort: data.externalAdminPort,
			});
		}
	}, [form.reset, data, form]);

	const onSubmit = async (values: DockerProvider) => {
		await mutateAsync({
			externalPort: values.externalPort,
			externalGRPCPort: values.externalGRPCPort,
			externalAdminPort: values.externalAdminPort,
			libsqlId,
		})
			.then(async () => {
				toast.success("External port/ports updated");
				await refetch();
			})
			.catch((error: Error) => {
				toast.error(error?.message || "Error saving the external port/ports");
			});
	};

	useEffect(() => {
		const port = form.watch("externalPort") || data?.externalPort;
		setConnectionUrl(
			`http://${data?.databaseUser}:${data?.databasePassword}@${getIp}:${port}`,
		);

		if (data?.sqldNode !== "replica") {
			const grpcPort = form.watch("externalGRPCPort") || data?.externalGRPCPort;
			setGRPCConnectionUrl(
				`http://${data?.databaseUser}:${data?.databasePassword}@${getIp}:${grpcPort}`,
			);
		}
	}, [
		data?.externalGRPCPort,
		data?.databasePassword,
		form,
		data?.databaseUser,
		getIp,
	]);

	return (
		<div className="flex w-full flex-col gap-5">
			<LayerCard className="bg-background">
				<div>
					<h3 className="text-xl">External Credentials</h3>
					<p>
						In order to make the database reachable through the internet, you
						must set a port and ensure that the port is not being used by
						another application or database
					</p>
				</div>
				<div className="flex w-full flex-col gap-4">
					{!getIp && (
						<AlertBlock type="warning">
							You need to set an IP address in your{" "}
							<Link href="/dashboard/settings/server" className="text-primary">
								Runtime network settings
							</Link>{" "}
							to fix the database url connection.
						</AlertBlock>
					)}
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="flex flex-col gap-4"
						>
							<div className="grid grid-cols-2 gap-4">
								<div className="col-span-2 space-y-4">
									<FormField
										control={form.control}
										name="externalPort"
										render={({ field }) => (
											<FormItem>
												<FormLabel>External Port (Internet)</FormLabel>
												<FormControl>
													<Input
														placeholder="8080"
														{...field}
														value={field.value as string}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>
							{!!data?.externalPort && (
								<div className="grid w-full gap-8">
									<div className="flex flex-col gap-3">
										<Label>External Host</Label>
										<ToggleVisibilityInput value={connectionUrl} disabled />
									</div>
								</div>
							)}

							<div className="grid grid-cols-2 gap-4">
								<div className="col-span-2 space-y-4">
									<FormField
										control={form.control}
										name="externalAdminPort"
										render={({ field }) => (
											<FormItem>
												<FormLabel>External Admin Port (Internet)</FormLabel>
												<FormControl>
													<Input
														placeholder="5000"
														{...field}
														value={field.value as string}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							{data?.sqldNode !== "replica" && (
								<>
									<div className="grid grid-cols-2 gap-4">
										<div className="col-span-2 space-y-4">
											<FormField
												control={form.control}
												name="externalGRPCPort"
												render={({ field }) => (
													<FormItem>
														<FormLabel>External GRPC Port (Internet)</FormLabel>
														<FormControl>
															<Input
																placeholder="5001"
																{...field}
																value={field.value as string}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									</div>
									{!!data?.externalGRPCPort && (
										<div className="grid w-full gap-8">
											<div className="flex flex-col gap-3">
												<Label>External GRPC Host</Label>
												<ToggleVisibilityInput
													value={connectionGRPCUrl}
													disabled
												/>
											</div>
										</div>
									)}
								</>
							)}

							<div className="flex justify-end">
								<Button type="submit" loading={isPending}>
									Save
								</Button>
							</div>
						</form>
					</Form>
				</div>
			</LayerCard>
		</div>
	);
};
