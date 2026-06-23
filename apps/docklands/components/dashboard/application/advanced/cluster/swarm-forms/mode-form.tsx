import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "@/client/api/trpc";
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

interface ModeFormProps {
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

export const ModeForm = ({ id, type }: ModeFormProps) => {
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

	const onSubmit = async (formData: any) => {
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
		} catch {
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
							<Select
								aria-label="Service mode"
								onValueChange={field.onChange}
								value={field.value}
							>
								<FormControl>
									<></>
								</FormControl>
								<>
									<Select.Option value="Replicated">Replicated</Select.Option>
									<Select.Option value="Global">Global</Select.Option>
								</>
							</Select>
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
