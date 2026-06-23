import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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

export const restartPolicyFormSchema = z.object({
	Condition: z.string().optional(),
	Delay: z.coerce.number().optional(),
	MaxAttempts: z.coerce.number().optional(),
	Window: z.coerce.number().optional(),
});

interface RestartPolicyFormProps {
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

export const RestartPolicyForm = ({ id, type }: RestartPolicyFormProps) => {
	const [isLoading, setIsLoading] = useState(false);

	const isApplication = type === "application";
	const applicationQuery = api.application.one.useQuery(
		{ applicationId: id },
		{ enabled: !!id && isApplication },
	);
	const databaseQuery = api.database.one.useQuery(
		{ databaseId: id },
		{ enabled: !!id && !isApplication },
	);
	const { data, refetch } = isApplication ? applicationQuery : databaseQuery;

	const applicationMutation = api.application.update.useMutation();
	const databaseMutation = api.database.update.useMutation();
	const { mutateAsync } = isApplication
		? applicationMutation
		: databaseMutation;

	const form = useForm<any>({
		resolver: zodResolver(restartPolicyFormSchema),
		defaultValues: {
			Condition: undefined,
			Delay: undefined,
			MaxAttempts: undefined,
			Window: undefined,
		},
	});

	useEffect(() => {
		if (data?.restartPolicySwarm) {
			form.reset({
				Condition: data.restartPolicySwarm.Condition,
				Delay: data.restartPolicySwarm.Delay,
				MaxAttempts: data.restartPolicySwarm.MaxAttempts,
				Window: data.restartPolicySwarm.Window,
			});
		}
	}, [data, form]);

	const onSubmit = async (
		formData: z.infer<typeof restartPolicyFormSchema>,
	) => {
		setIsLoading(true);
		try {
			// Check if all values are empty, if so, send null to clear the database
			const hasAnyValue = Object.values(formData).some(
				(value) => value !== undefined && value !== null && value !== "",
			);

			await mutateAsync({
				applicationId: id || "",
				databaseId: id,
				restartPolicySwarm: hasAnyValue ? formData : null,
			});

			toast.success("Restart policy updated successfully");
			refetch();
		} catch (err) {
			logger.error("Error updating restart policy", err);
			toast.error("Error updating restart policy");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="Condition"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Condition</FormLabel>
							<FormDescription>When to restart the container</FormDescription>
							<Select
								aria-label="Restart condition"
								onValueChange={field.onChange}
								value={field.value}
							>
								<FormControl>
									<></>
								</FormControl>
								<>
									<Select.Option value="none">None</Select.Option>
									<Select.Option value="on-failure">On Failure</Select.Option>
									<Select.Option value="any">Any</Select.Option>
								</>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Delay"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Delay (nanoseconds)</FormLabel>
							<FormDescription>
								Wait time between restart attempts
							</FormDescription>
							<FormControl>
								<Input type="number" placeholder="10000000000" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="MaxAttempts"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Max Attempts</FormLabel>
							<FormDescription>
								Maximum number of restart attempts
							</FormDescription>
							<FormControl>
								<Input type="number" placeholder="3" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Window"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Window (nanoseconds)</FormLabel>
							<FormDescription>
								Time window to evaluate restart policy
							</FormDescription>
							<FormControl>
								<Input type="number" placeholder="10000000000" {...field} />
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
								Condition: undefined,
								Delay: undefined,
								MaxAttempts: undefined,
								Window: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Restart Policy
					</Button>
				</div>
			</form>
		</Form>
	);
};
