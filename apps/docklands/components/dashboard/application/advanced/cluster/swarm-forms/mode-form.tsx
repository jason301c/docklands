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
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";
import { type SwarmServiceType, useServiceData } from "./use-service-data";

const logger = createClientLogger("application");

export const modeFormSchema = z.object({
	type: z.enum(["Replicated", "Global"]).optional(),
	Replicas: z.union([z.string(), z.number()]).optional(),
});

interface ModeFormProps {
	id: string;
	type: SwarmServiceType;
}

export const ModeForm = ({ id, type }: ModeFormProps) => {
	const [isLoading, setIsLoading] = useState(false);

	const { data, refetch, mutateAsync } = useServiceData(id, type);

	const form = useForm({
		resolver: zodResolver(modeFormSchema),
		defaultValues: {
			type: undefined,
			Replicas: undefined,
		},
	});

	const modeType = form.watch("type");

	useEffect(() => {
		if (data?.modeSwarm) {
			const mode = data.modeSwarm;
			if (mode.Replicated) {
				form.reset({
					type: "Replicated",
					Replicas: mode.Replicated.Replicas,
				});
			} else if (mode.Global) {
				form.reset({
					type: "Global",
					Replicas: undefined,
				});
			}
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof modeFormSchema>) => {
		setIsLoading(true);
		try {
			// If no type is selected, send null to clear the database
			if (!formData.type) {
				await mutateAsync({
					applicationId: id || "",
					databaseId: id,
					modeSwarm: null,
				});
				toast.success("Mode updated successfully");
				refetch();
				setIsLoading(false);
				return;
			}

			const modeData =
				formData.type === "Replicated"
					? {
							Replicated: {
								Replicas:
									formData.Replicas !== undefined && formData.Replicas !== ""
										? Number(formData.Replicas)
										: undefined,
							},
						}
					: { Global: {} };

			await mutateAsync({
				applicationId: id || "",
				databaseId: id,
				modeSwarm: modeData,
			});

			toast.success("Mode updated successfully");
			refetch();
		} catch (err) {
			logger.error("Error updating mode", err);
			toast.error("Error updating mode");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="type"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Mode Type</FormLabel>
							<FormDescription>
								Choose between replicated or global service mode
							</FormDescription>
							<FormControl>
								<Select
									aria-label="Service mode"
									onValueChange={field.onChange}
									value={field.value}
								>
									<Select.Option value="Replicated">Replicated</Select.Option>
									<Select.Option value="Global">Global</Select.Option>
								</Select>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				{modeType === "Replicated" && (
					<FormField
						control={form.control}
						name="Replicas"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Replicas</FormLabel>
								<FormDescription>Number of replicas to run</FormDescription>
								<FormControl>
									<Input type="number" placeholder="1" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.reset({
								type: undefined,
								Replicas: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" loading={isLoading}>
						Save Mode
					</Button>
				</div>
			</form>
		</Form>
	);
};
