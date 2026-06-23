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
import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";
import {
	asLibsql,
	asMongo,
	asMysql,
	asPostgres,
	asRedis,
} from "./engine-config";

const logger = createClientLogger("database-service");

const DockerProviderSchema = z.object({
	externalPort: z.preprocess((a) => {
		if (a !== null) {
			const parsed = Number.parseInt(z.string().parse(a), 10);
			return Number.isNaN(parsed) ? null : parsed;
		}
		return null;
	}, z
		.number()
		.gte(0, "Range must be 0 - 65535")
		.lte(65535, "Range must be 0 - 65535")
		.nullable()),
});

type DockerProvider = z.infer<typeof DockerProviderSchema>;

interface Props {
	databaseId: string;
}

export const ShowExternalDatabaseCredentials = ({ databaseId }: Props) => {
	const { data: ip } = api.settings.getIp.useQuery();
	const { data, refetch } = api.database.one.useQuery({ databaseId });
	const { mutateAsync, isPending } =
		api.database.saveExternalPort.useMutation();
	const getIp = data?.runtimeWorker?.ipAddress || ip;
	const [connectionUrl, setConnectionUrl] = useState("");

	const form = useForm({
		defaultValues: {},
		resolver: zodResolver(DockerProviderSchema),
	});

	useEffect(() => {
		if (data?.externalPort) {
			form.reset({
				externalPort: data.externalPort,
			});
		}
	}, [form.reset, data, form]);

	const onSubmit = async (values: DockerProvider) => {
		await mutateAsync({
			externalPort: values.externalPort,
			databaseId,
		})
			.then(async () => {
				toast.success("External Port updated");
				await refetch();
			})
			.catch((error: Error) => {
				logger.error("Error fetching external database credentials", error);
				toast.error(error?.message || "Error saving the external port");
			});
	};

	useEffect(() => {
		const buildConnectionUrl = () => {
			const port = form.watch("externalPort") || data?.externalPort;
			const config = data?.config;
			if (!data || !config) return "";

			switch (data.engine) {
				case "postgres": {
					const c = asPostgres(config);
					return `postgresql://${c.databaseUser}:${c.databasePassword}@${getIp}:${port}/${c.databaseName}`;
				}
				case "mysql": {
					const c = asMysql(config);
					return `mysql://${c.databaseUser}:${c.databasePassword}@${getIp}:${port}/${c.databaseName}`;
				}
				case "mariadb": {
					const c = asMysql(config);
					return `mariadb://${c.databaseUser}:${c.databasePassword}@${getIp}:${port}/${c.databaseName}`;
				}
				case "mongo": {
					const c = asMongo(config);
					return `mongodb://${c.databaseUser}:${c.databasePassword}@${getIp}:${port}/?authSource=admin${c.replicaSets ? "" : "&directConnection=true"}`;
				}
				case "redis": {
					const c = asRedis(config);
					return `redis://default:${c.databasePassword}@${getIp}:${port}`;
				}
				case "libsql":
					return `http://${getIp}:${port}`;
				default:
					return "";
			}
		};

		setConnectionUrl(buildConnectionUrl());
	}, [data, form, getIp]);

	const config = data?.config;
	const libsqlPorts =
		data?.engine === "libsql" && config
			? {
					grpc: asLibsql(config).externalGRPCPort,
					admin: asLibsql(config).externalAdminPort,
				}
			: null;

	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<LayerCard className="bg-kumo-canvas">
					<div>
						<h3 className="text-xl font-semibold">External Credentials</h3>
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
								<Link
									href="/dashboard/settings/ingress"
									className="text-kumo-brand"
								>
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
								<div className="grid grid-cols-2 gap-4 ">
									<div className="col-span-2 space-y-4">
										<FormField
											control={form.control}
											name="externalPort"
											render={({ field }) => {
												return (
													<FormItem>
														<FormLabel>External Port (Internet)</FormLabel>
														<FormControl>
															<Input
																placeholder="5432"
																{...field}
																value={field.value as string}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												);
											}}
										/>
									</div>
								</div>
								{libsqlPorts &&
									(libsqlPorts.grpc != null || libsqlPorts.admin != null) && (
										<div className="grid grid-cols-2 gap-4">
											{libsqlPorts.grpc != null && (
												<div className="flex flex-col gap-2">
													<Label>External GRPC Port (Internet)</Label>
													<Input
														aria-label="External GRPC port"
														disabled
														value={String(libsqlPorts.grpc)}
													/>
												</div>
											)}
											{libsqlPorts.admin != null && (
												<div className="flex flex-col gap-2">
													<Label>External Admin Port (Internet)</Label>
													<Input
														aria-label="External admin port"
														disabled
														value={String(libsqlPorts.admin)}
													/>
												</div>
											)}
										</div>
									)}
								{!!data?.externalPort && (
									<div className="grid w-full gap-8">
										<div className="flex flex-col gap-3">
											<Label>External Host</Label>
											<ToggleVisibilityInput value={connectionUrl} disabled />
										</div>
									</div>
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
		</>
	);
};
