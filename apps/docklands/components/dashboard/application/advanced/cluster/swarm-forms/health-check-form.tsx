import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { optionalNumber } from "./schemas";
import { type SwarmServiceType, useServiceData } from "./use-service-data";

const logger = createClientLogger("application");

export const healthCheckFormSchema = z.object({
	Test: z.array(z.string()).optional(),
	Interval: optionalNumber,
	Timeout: optionalNumber,
	StartPeriod: optionalNumber,
	Retries: optionalNumber,
});

interface HealthCheckFormProps {
	id: string;
	type: SwarmServiceType;
}

export const HealthCheckForm = ({ id, type }: HealthCheckFormProps) => {
	const [isLoading, setIsLoading] = useState(false);

	const { data, refetch, mutateAsync } = useServiceData(id, type);

	const form = useForm({
		resolver: zodResolver(healthCheckFormSchema),
		defaultValues: {
			Test: [],
			Interval: undefined,
			Timeout: undefined,
			StartPeriod: undefined,
			Retries: undefined,
		},
	});

	const testCommands = form.watch("Test") || [];

	useEffect(() => {
		if (data?.healthCheckSwarm) {
			const hc = data.healthCheckSwarm;
			form.reset({
				Test: hc.Test || [],
				Interval: hc.Interval,
				Timeout: hc.Timeout,
				StartPeriod: hc.StartPeriod,
				Retries: hc.Retries,
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof healthCheckFormSchema>) => {
		setIsLoading(true);
		try {
			// Check if all values are empty, if so, send null to clear the database
			const hasAnyValue =
				(formData.Test && formData.Test.length > 0) ||
				formData.Interval !== undefined ||
				formData.Timeout !== undefined ||
				formData.StartPeriod !== undefined ||
				formData.Retries !== undefined;

			await mutateAsync({
				applicationId: id || "",
				databaseId: id,
				healthCheckSwarm: hasAnyValue ? formData : null,
			});

			toast.success("Health check updated successfully");
			refetch();
		} catch (err) {
			logger.error("Error updating health check", err);
			toast.error("Error updating health check");
		} finally {
			setIsLoading(false);
		}
	};

	const addTestCommand = () => {
		form.setValue("Test", [...testCommands, ""]);
	};

	const updateTestCommand = (index: number, value: string) => {
		const newCommands = [...testCommands];
		newCommands[index] = value;
		form.setValue("Test", newCommands);
	};

	const removeTestCommand = (index: number) => {
		form.setValue(
			"Test",
			testCommands.filter((_: string, i: number) => i !== index),
		);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div>
					<FormLabel>Test Commands</FormLabel>
					<FormDescription>
						Command to run for health check (e.g., ["CMD-SHELL", "curl -f
						http://localhost:3000/health"])
					</FormDescription>
					<div className="space-y-2 mt-2">
						{testCommands.map((cmd: string, index: number) => (
							<div key={index} className="flex gap-2">
								<Input
									aria-label={`Health check test command ${index + 1}`}
									value={cmd}
									onChange={(e) => updateTestCommand(index, e.target.value)}
									placeholder={
										index === 0
											? "CMD-SHELL"
											: "curl -f http://localhost:3000/health"
									}
								/>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={() => removeTestCommand(index)}
								>
									Remove
								</Button>
							</div>
						))}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addTestCommand}
						>
							Add Command
						</Button>
					</div>
				</div>

				<FormField
					control={form.control}
					name="Interval"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Interval (nanoseconds)</FormLabel>
							<FormDescription>
								Time between health checks (e.g., 10000000000 for 10 seconds)
							</FormDescription>
							<FormControl>
								<Input
									type="number"
									placeholder="10000000000"
									{...field}
									value={field.value ?? ""}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Timeout"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Timeout (nanoseconds)</FormLabel>
							<FormDescription>
								Maximum time to wait for health check response
							</FormDescription>
							<FormControl>
								<Input
									type="number"
									placeholder="10000000000"
									{...field}
									value={field.value ?? ""}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="StartPeriod"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Start Period (nanoseconds)</FormLabel>
							<FormDescription>
								Initial grace period before health checks begin
							</FormDescription>
							<FormControl>
								<Input
									type="number"
									placeholder="10000000000"
									{...field}
									value={field.value ?? ""}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Retries"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Retries</FormLabel>
							<FormDescription>
								Number of consecutive failures needed to consider container
								unhealthy
							</FormDescription>
							<FormControl>
								<Input
									type="number"
									placeholder="3"
									{...field}
									value={field.value ?? ""}
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
								Test: [],
								Interval: undefined,
								Timeout: undefined,
								StartPeriod: undefined,
								Retries: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Health Check
					</Button>
				</div>
			</form>
		</Form>
	);
};
