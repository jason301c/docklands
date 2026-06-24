import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
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
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";
import { swarmConfigFormSchema } from "./schemas";
import { type SwarmServiceType, useServiceData } from "./use-service-data";

const logger = createClientLogger("application");

interface UpdateConfigFormProps {
	id: string;
	type: SwarmServiceType;
}

export const UpdateConfigForm = ({ id, type }: UpdateConfigFormProps) => {
	const [isLoading, setIsLoading] = useState(false);

	const { data, refetch, mutateAsync } = useServiceData(id, type);

	const form = useForm({
		resolver: zodResolver(swarmConfigFormSchema),
		defaultValues: {
			Parallelism: undefined,
			Delay: undefined,
			FailureAction: undefined,
			Monitor: undefined,
			MaxFailureRatio: undefined,
			Order: undefined,
		},
	});

	useEffect(() => {
		if (data?.updateConfigSwarm) {
			const config = data.updateConfigSwarm;
			form.reset({
				Parallelism: config.Parallelism,
				Delay: config.Delay,
				FailureAction: config.FailureAction,
				Monitor: config.Monitor,
				MaxFailureRatio: config.MaxFailureRatio,
				Order: config.Order,
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof swarmConfigFormSchema>) => {
		setIsLoading(true);
		try {
			// Check if all values are empty, if so, send null to clear the database
			const hasAnyValue = Object.values(formData).some(
				(value) => value !== undefined && value !== null && value !== "",
			);

			await mutateAsync({
				applicationId: id || "",
				databaseId: id,
				updateConfigSwarm: (hasAnyValue ? formData : null) as any,
			});

			toast.success("Update config updated successfully");
			refetch();
		} catch (err) {
			logger.error("Error updating update config", err);
			toast.error("Error updating update config");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="Parallelism"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Parallelism</FormLabel>
							<FormDescription>
								Number of tasks to update simultaneously
							</FormDescription>
							<FormControl>
								<Input type="number" placeholder="1" {...field} />
							</FormControl>
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
							<FormDescription>Delay between task updates</FormDescription>
							<FormControl>
								<Input type="number" placeholder="10000000000" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="FailureAction"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Failure Action</FormLabel>
							<FormDescription>Action on update failure</FormDescription>
							<FormControl>
								<Select
									aria-label="Update failure action"
									onValueChange={field.onChange}
									value={field.value}
								>
									<Select.Option value="pause">Pause</Select.Option>
									<Select.Option value="continue">Continue</Select.Option>
									<Select.Option value="rollback">Rollback</Select.Option>
								</Select>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Monitor"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Monitor (nanoseconds)</FormLabel>
							<FormDescription>
								Duration to monitor for failure after update
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
					name="MaxFailureRatio"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Max Failure Ratio</FormLabel>
							<FormDescription>
								Maximum failure ratio tolerated (0-1)
							</FormDescription>
							<FormControl>
								<Input type="number" step="0.01" placeholder="0.1" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Order"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Order</FormLabel>
							<FormDescription>Update order strategy</FormDescription>
							<FormControl>
								<Select
									aria-label="Update order"
									onValueChange={field.onChange}
									value={field.value}
								>
									<Select.Option value="stop-first">Stop First</Select.Option>
									<Select.Option value="start-first">Start First</Select.Option>
								</Select>
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
								Parallelism: undefined,
								Delay: undefined,
								FailureAction: undefined,
								Monitor: undefined,
								MaxFailureRatio: undefined,
								Order: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Update Config
					</Button>
				</div>
			</form>
		</Form>
	);
};
