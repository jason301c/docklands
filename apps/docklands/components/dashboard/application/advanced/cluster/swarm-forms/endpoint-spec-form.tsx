import { Button } from "@cloudflare/kumo/components/button";
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
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";
import { type SwarmServiceType, useServiceData } from "./use-service-data";

const logger = createClientLogger("application");

export const endpointSpecFormSchema = z.object({
	Mode: z.string().optional(),
});

interface EndpointSpecFormProps {
	id: string;
	type: SwarmServiceType;
}

export const EndpointSpecForm = ({ id, type }: EndpointSpecFormProps) => {
	const [isLoading, setIsLoading] = useState(false);

	const { data, refetch, mutateAsync } = useServiceData(id, type);

	const form = useForm<z.infer<typeof endpointSpecFormSchema>>({
		resolver: zodResolver(endpointSpecFormSchema),
		defaultValues: {
			Mode: undefined,
		},
	});

	useEffect(() => {
		if (data?.endpointSpecSwarm) {
			const es = data.endpointSpecSwarm;
			form.reset({
				Mode: es.Mode,
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof endpointSpecFormSchema>) => {
		setIsLoading(true);
		try {
			// Check if all values are empty, if so, send null to clear the database
			const hasAnyValue =
				formData.Mode !== undefined &&
				formData.Mode !== null &&
				formData.Mode !== "";

			await mutateAsync({
				applicationId: id || "",
				databaseId: id,
				endpointSpecSwarm: hasAnyValue ? formData : null,
			});

			toast.success("Endpoint spec updated successfully");
			refetch();
		} catch (err) {
			logger.error("Error updating endpoint spec", err);
			toast.error("Error updating endpoint spec");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="Mode"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Mode</FormLabel>
							<FormDescription>Endpoint mode (vip or dnsrr)</FormDescription>
							<Select
								aria-label="Endpoint mode"
								onValueChange={field.onChange}
								value={field.value}
							>
								<FormControl>
									<></>
								</FormControl>
								<>
									<Select.Option value="vip">VIP (Virtual IP)</Select.Option>
									<Select.Option value="dnsrr">DNS Round Robin</Select.Option>
								</>
							</Select>
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
								Mode: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Endpoint Spec
					</Button>
				</div>
			</form>
		</Form>
	);
};
