import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
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

const logger = createClientLogger("application");

export const labelsFormSchema = z.object({
	labels: z
		.array(
			z.object({
				key: z.string(),
				value: z.string(),
			}),
		)
		.optional(),
});

interface LabelsFormProps {
	id: string;
	type:
		| "postgres"
		| "mariadb"
		| "mongo"
		| "mysql"
		| "redis"
		| "application"
		| "libsql";
}

export const LabelsForm = ({ id, type }: LabelsFormProps) => {
	const [isLoading, setIsLoading] = useState(false);

	const queryMap = {
		postgres: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		redis: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		mysql: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		mariadb: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		application: () =>
			api.application.one.useQuery({ applicationId: id }, { enabled: !!id }),
		mongo: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
		libsql: () =>
			api.database.one.useQuery({ databaseId: id }, { enabled: !!id }),
	};
	const { data, refetch } = queryMap[type]
		? queryMap[type]()
		: api.database.one.useQuery({ databaseId: id }, { enabled: !!id });

	const mutationMap = {
		postgres: () => api.database.update.useMutation(),
		redis: () => api.database.update.useMutation(),
		mysql: () => api.database.update.useMutation(),
		mariadb: () => api.database.update.useMutation(),
		application: () => api.application.update.useMutation(),
		mongo: () => api.database.update.useMutation(),
		libsql: () => api.database.update.useMutation(),
	};

	const { mutateAsync } = mutationMap[type]
		? mutationMap[type]()
		: api.database.update.useMutation();

	const form = useForm<any>({
		resolver: zodResolver(labelsFormSchema),
		defaultValues: {
			labels: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "labels",
	});

	useEffect(() => {
		if (data?.labelsSwarm && typeof data.labelsSwarm === "object") {
			const labelEntries = Object.entries(data.labelsSwarm).map(
				([key, value]) => ({
					key,
					value: value as string,
				}),
			);
			form.reset({ labels: labelEntries });
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof labelsFormSchema>) => {
		setIsLoading(true);
		try {
			const labelsObject =
				formData.labels?.reduce(
					(acc, { key, value }) => {
						if (key && value) {
							acc[key] = value;
						}
						return acc;
					},
					{} as Record<string, string>,
				) || {};

			// If no labels, send null to clear the database
			const labelsToSend =
				Object.keys(labelsObject).length > 0 ? labelsObject : null;

			await mutateAsync({
				applicationId: id || "",
				databaseId: id,
				labelsSwarm: labelsToSend,
			});

			toast.success("Labels updated successfully");
			refetch();
		} catch (err) {
			logger.error("Error updating labels", err);
			toast.error("Error updating labels");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div>
					<FormLabel>Labels</FormLabel>
					<FormDescription>
						Add key-value labels to your service
					</FormDescription>
					<div className="space-y-2 mt-2">
						{fields.map((field, index) => (
							<div key={field.id} className="flex gap-2">
								<FormField
									control={form.control}
									name={`labels.${index}.key`}
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormControl>
												<Input {...field} placeholder="com.example.app.name" />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name={`labels.${index}.value`}
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormControl>
												<Input {...field} placeholder="my-app" />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={() => remove(index)}
								>
									Remove
								</Button>
							</div>
						))}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => append({ key: "", value: "" })}
						>
							Add Label
						</Button>
					</div>
				</div>

				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.reset({ labels: [] });
						}}
					>
						Clear
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Labels
					</Button>
				</div>
			</form>
		</Form>
	);
};
