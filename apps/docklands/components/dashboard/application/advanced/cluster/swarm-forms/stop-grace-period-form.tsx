import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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

const hasStopGracePeriodSwarm = (
	value: unknown,
): value is { stopGracePeriodSwarm: number | string | null } =>
	typeof value === "object" &&
	value !== null &&
	"stopGracePeriodSwarm" in value;

interface StopGracePeriodFormProps {
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

export const StopGracePeriodForm = ({ id, type }: StopGracePeriodFormProps) => {
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
		defaultValues: {
			value: null as number | null,
		},
	});

	useEffect(() => {
		if (hasStopGracePeriodSwarm(data)) {
			const value = data.stopGracePeriodSwarm;
			const normalizedValue =
				value === null || value === undefined ? null : Number(value);
			form.reset({
				value: normalizedValue,
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: any) => {
		setIsLoading(true);
		try {
			await mutateAsync({
				applicationId: id || "",
				databaseId: id,
				stopGracePeriodSwarm: formData.value,
			});

			toast.success("Stop grace period updated successfully");
			refetch();
		} catch (err) {
			logger.error("Error updating stop grace period", err);
			toast.error("Error updating stop grace period");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="value"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Stop Grace Period (nanoseconds)</FormLabel>
							<FormDescription>
								Time to wait before forcefully killing the container
								<br />
								Examples: 30000000000 (30s), 120000000000 (2m)
							</FormDescription>
							<FormControl>
								<Input
									type="number"
									placeholder="30000000000"
									{...field}
									value={
										field?.value !== null && field?.value !== undefined
											? field.value.toString()
											: ""
									}
									onChange={(e) =>
										field.onChange(
											e.target.value ? Number(e.target.value) : null,
										)
									}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.reset({
								value: null,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Stop Grace Period
					</Button>
				</div>
			</form>
		</Form>
	);
};
