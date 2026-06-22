import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBox } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const updatePostgresSchema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	description: z.string().optional(),
});

type UpdatePostgres = z.infer<typeof updatePostgresSchema>;

interface Props {
	postgresId: string;
}

export const UpdatePostgres = ({ postgresId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();
	const { mutateAsync, error, isError, isPending } =
		api.postgres.update.useMutation();
	const { data } = api.postgres.one.useQuery(
		{
			postgresId,
		},
		{
			enabled: !!postgresId,
		},
	);
	const form = useForm<UpdatePostgres>({
		defaultValues: {
			description: data?.description ?? "",
			name: data?.name ?? "",
		},
		resolver: zodResolver(updatePostgresSchema),
	});
	useEffect(() => {
		if (data) {
			form.reset({
				description: data.description ?? "",
				name: data.name,
			});
		}
	}, [data, form, form.reset]);

	const onSubmit = async (formData: UpdatePostgres) => {
		await mutateAsync({
			name: formData.name,
			postgresId: postgresId,
			description: formData.description || "",
		})
			.then(() => {
				toast.success("Postgres updated successfully");
				utils.postgres.one.invalidate({
					postgresId: postgresId,
				});
				setIsOpen(false);
			})
			.catch(() => {
				toast.error("Error updating Postgres");
			})
			.finally(() => {});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit PostgreSQL"
						variant="ghost"
						shape="square"
						className="group hover:bg-kumo-brand/10 focus-visible:ring-2 focus-visible:ring-offset-2"
					>
						<PenBox className="size-3.5 text-kumo-brand group-hover:text-kumo-brand" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Modify Postgres</Dialog.Title>
					<Dialog.Description>Update the Postgres data</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<div className="grid gap-4">
					<div className="grid items-center gap-4">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								id="hook-form-update-postgres"
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
								<div>
									<Button
										loading={isPending}
										form="hook-form-update-postgres"
										type="submit"
										className="flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										Update
									</Button>
								</div>
							</form>
						</Form>
					</div>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
