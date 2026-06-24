import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBox } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("database-service");

const updateDatabaseSchema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	description: z.string().optional(),
	dockerImage: z.string().min(1, {
		message: "Docker image is required",
	}),
	command: z.string().optional(),
});

type UpdateDatabaseForm = z.infer<typeof updateDatabaseSchema>;

interface Props {
	databaseId: string;
}

export const UpdateDatabase = ({ databaseId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();
	const { mutateAsync, error, isError, isPending } =
		api.database.update.useMutation();
	const { data } = api.database.one.useQuery(
		{
			databaseId,
		},
		{
			enabled: !!databaseId,
		},
	);
	const form = useForm<UpdateDatabaseForm>({
		defaultValues: {
			description: data?.description ?? "",
			name: data?.name ?? "",
			dockerImage: data?.dockerImage ?? "",
			command: data?.command ?? "",
		},
		resolver: zodResolver(updateDatabaseSchema),
	});
	useEffect(() => {
		if (data) {
			form.reset({
				description: data.description ?? "",
				name: data.name,
				dockerImage: data.dockerImage ?? "",
				command: data.command ?? "",
			});
		}
	}, [data, form, form.reset]);

	const onSubmit = async (formData: UpdateDatabaseForm) => {
		await mutateAsync({
			name: formData.name,
			databaseId: databaseId,
			description: formData.description || "",
			dockerImage: formData.dockerImage,
			command: formData.command || "",
		})
			.then(() => {
				toast.success("Database updated successfully");
				utils.database.one.invalidate({
					databaseId: databaseId,
				});
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error("Error updating Database", err);
				toast.error("Error updating Database");
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit Database"
						variant="ghost"
						shape="square"
						className="group hover:bg-kumo-brand/10 focus-visible:ring-2 focus-visible:ring-offset-2"
					>
						<PenBox className="size-3.5 text-kumo-brand group-hover:text-kumo-brand" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-lg">
				<Dialog.Header>
					<Dialog.Title>Modify Database</Dialog.Title>
					<Dialog.Description>Update the database data</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<div className="grid gap-4">
					<div className="grid items-center gap-4">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								id="hook-form-update-database"
								className="grid w-full gap-4 "
							>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input placeholder="Vandelay Industries" {...field} />
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Description for this service..."
													className="resize-none"
													{...field}
												/>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="dockerImage"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Docker Image</FormLabel>
											<FormControl>
												<Input placeholder="postgres:18" {...field} />
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="command"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Command</FormLabel>
											<FormControl>
												<Input
													placeholder="Custom container command (optional)"
													{...field}
												/>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
								<Dialog.Footer>
									<Button
										loading={isPending}
										form="hook-form-update-database"
										type="submit"
										className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										Update
									</Button>
								</Dialog.Footer>
							</form>
						</Form>
					</div>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
