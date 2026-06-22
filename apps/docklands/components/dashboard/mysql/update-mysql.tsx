import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon } from "lucide-react";
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

const updateMysqlSchema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	description: z.string().optional(),
});

type UpdateMysql = z.infer<typeof updateMysqlSchema>;

interface Props {
	mysqlId: string;
}

export const UpdateMysql = ({ mysqlId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();
	const { mutateAsync, error, isError, isPending } =
		api.mysql.update.useMutation();
	const { data } = api.mysql.one.useQuery(
		{
			mysqlId,
		},
		{
			enabled: !!mysqlId,
		},
	);
	const form = useForm<UpdateMysql>({
		defaultValues: {
			description: data?.description ?? "",
			name: data?.name ?? "",
		},
		resolver: zodResolver(updateMysqlSchema),
	});
	useEffect(() => {
		if (data) {
			form.reset({
				description: data.description ?? "",
				name: data.name,
			});
		}
	}, [data, form, form.reset]);

	const onSubmit = async (formData: UpdateMysql) => {
		await mutateAsync({
			name: formData.name,
			mysqlId: mysqlId,
			description: formData.description || "",
		})
			.then(() => {
				toast.success("MySQL updated successfully");
				utils.mysql.one.invalidate({
					mysqlId: mysqlId,
				});
				setIsOpen(false);
			})
			.catch(() => {
				toast.error("Error updating MySQL");
			})
			.finally(() => {});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit MySQL"
						variant="ghost"
						shape="square"
						className="group hover:bg-blue-500/10 "
					>
						<PenBoxIcon className="size-3.5  text-primary group-hover:text-blue-500" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Modify MySQL</Dialog.Title>
					<Dialog.Description>Update the MySQL data</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<div className="grid gap-4">
					<div className="grid items-center gap-4">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								id="hook-form-mysql-update"
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
										form="hook-form-mysql-update"
										type="submit"
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
