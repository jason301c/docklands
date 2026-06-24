import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon } from "lucide-react";
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

const logger = createClientLogger("compose");

const updateComposeSchema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	description: z.string().optional(),
});

type UpdateCompose = z.infer<typeof updateComposeSchema>;

interface Props {
	composeId: string;
}

export const UpdateCompose = ({ composeId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();
	const { mutateAsync, error, isError, isPending } =
		api.compose.update.useMutation();
	const { data } = api.compose.one.useQuery(
		{
			composeId,
		},
		{
			enabled: !!composeId,
		},
	);
	const form = useForm<UpdateCompose>({
		defaultValues: {
			description: data?.description ?? "",
			name: data?.name ?? "",
		},
		resolver: zodResolver(updateComposeSchema),
	});
	useEffect(() => {
		if (data) {
			form.reset({
				description: data.description ?? "",
				name: data.name,
			});
		}
	}, [data, form, form.reset]);

	const onSubmit = async (formData: UpdateCompose) => {
		await mutateAsync({
			name: formData.name,
			composeId: composeId,
			description: formData.description || "",
		})
			.then(() => {
				toast.success("Compose updated successfully");
				utils.compose.one.invalidate({
					composeId: composeId,
				});
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error("Failed to update the compose", err);
				toast.error("Error updating the Compose");
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit compose stack"
						variant="ghost"
						shape="square"
						className="group hover:bg-kumo-brand/10 "
					>
						<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-lg">
				<Dialog.Header>
					<Dialog.Title>Modify Compose</Dialog.Title>
					<Dialog.Description>Update the compose data</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<div className="grid gap-4">
					<div className="grid items-center gap-4">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								id="hook-form-update-compose"
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
								<Dialog.Footer>
									<Button
										loading={isPending}
										form="hook-form-update-compose"
										type="submit"
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
