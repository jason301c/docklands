import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { CodeEditor } from "@/components/shared/code-editor";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { Toggle } from "@/components/shared/toggle";
import type { ServiceType } from "../advanced/show-resources";

const addEnvironmentSchema = z.object({
	environment: z.string(),
});

type EnvironmentSchema = z.infer<typeof addEnvironmentSchema>;

const logger = createClientLogger("environment");

interface Props {
	id: string;
	type: Exclude<ServiceType | "compose", "application">;
}

export const ShowEnvironment = ({ id, type }: Props) => {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canWrite = permissions?.envVars.write ?? false;
	const queryMap = {
		compose: () =>
			api.compose.one.useQuery({ composeId: id }, { enabled: !!id }),
		libsql: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
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
	const [isEnvVisible, setIsEnvVisible] = useState(true);

	const mutationMap = {
		compose: () => api.compose.saveEnvironment.useMutation(),
		libsql: () => api.database.saveEnvironment.useMutation(),
		mariadb: () => api.database.saveEnvironment.useMutation(),
		mongo: () => api.database.saveEnvironment.useMutation(),
		mysql: () => api.database.saveEnvironment.useMutation(),
		postgres: () => api.database.saveEnvironment.useMutation(),
		redis: () => api.database.saveEnvironment.useMutation(),
	};
	const { mutateAsync, isPending } = mutationMap[type]
		? mutationMap[type]()
		: api.database.saveEnvironment.useMutation();

	const form = useForm<EnvironmentSchema>({
		defaultValues: {
			environment: "",
		},
		resolver: zodResolver(addEnvironmentSchema),
	});

	// Watch form value
	const currentEnvironment = form.watch("environment");
	const hasChanges = currentEnvironment !== (data?.env || "");

	useEffect(() => {
		if (data) {
			form.reset({
				environment: data.env || "",
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: EnvironmentSchema) => {
		mutateAsync({
			composeId: id || "",
			databaseId: id,
			env: formData.environment,
		})
			.then(async () => {
				toast.success("Environments Added");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to save environment", err);
				toast.error("Error adding environment");
			});
	};

	const handleCancel = () => {
		form.reset({
			environment: data?.env || "",
		});
	};

	// Add keyboard shortcut for Ctrl+S/Cmd+S
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.code === "KeyS" && !isPending) {
				e.preventDefault();
				form.handleSubmit(onSubmit)();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [form, onSubmit, isPending]);

	return (
		<div className="flex w-full flex-col gap-5 ">
			<LayerCard className="bg-kumo-canvas">
				<div className="flex flex-row w-full items-center justify-between">
					<div>
						<h3 className="text-xl font-semibold">Environment Settings</h3>
						<p>
							You can add environment variables to your resource.
							{hasChanges && (
								<span className="text-kumo-warning ml-2">
									(You have unsaved changes)
								</span>
							)}
						</p>
					</div>

					<Toggle
						aria-label="Toggle bold"
						pressed={isEnvVisible}
						onPressedChange={setIsEnvVisible}
					>
						{isEnvVisible ? (
							<EyeOffIcon className="h-4 w-4 text-kumo-subtle" />
						) : (
							<EyeIcon className="h-4 w-4 text-kumo-subtle" />
						)}
					</Toggle>
				</div>
				<div>
					<Form {...form}>
						<form
							id="hook-form"
							onSubmit={form.handleSubmit(onSubmit)}
							className="w-full space-y-4"
						>
							<FormField
								control={form.control}
								name="environment"
								render={({ field }) => (
									<FormItem>
										<FormControl className="">
											<CodeEditor
												style={
													{
														WebkitTextSecurity: isEnvVisible ? "disc" : null,
													} as CSSProperties
												}
												language="properties"
												disabled={isEnvVisible}
												className="font-mono"
												wrapperClassName="compose-file-editor"
												placeholder={`NODE_ENV=production
PORT=3000
														`}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{canWrite && (
								<div className="flex flex-row justify-end gap-2">
									{hasChanges && (
										<Button
											type="button"
											variant="outline"
											onClick={handleCancel}
										>
											Cancel
										</Button>
									)}
									<Button
										loading={isPending}
										className="w-fit"
										type="submit"
										disabled={!hasChanges}
									>
										Save
									</Button>
								</div>
							)}
						</form>
					</Form>
				</div>
			</LayerCard>
		</div>
	);
};
