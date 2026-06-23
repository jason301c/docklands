import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import copy from "copy-to-clipboard";
import { Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
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
import type { ServiceType } from "@/server/core/db/schema";
import { workspaceEnvironmentPath } from "@/shared/routes";

const logger = createClientLogger("compose");

const deleteComposeSchema = z.object({
	projectName: z.string().min(1, {
		message: "Compose name is required",
	}),
	deleteVolumes: z.boolean(),
});

type DeleteCompose = z.infer<typeof deleteComposeSchema>;

interface Props {
	id: string;
	type: ServiceType | "application";
}

export const DeleteService = ({ id, type }: Props) => {
	const { permissions } = usePermissions();
	const canDelete = permissions?.service.delete ?? false;
	const [isOpen, setIsOpen] = useState(false);

	const isApplication = type === "application";
	const isCompose = type === "compose";

	const applicationQuery = api.application.one.useQuery(
		{ applicationId: id },
		{ enabled: !!id && isApplication },
	);
	const composeQuery = api.compose.one.useQuery(
		{ composeId: id },
		{ enabled: !!id && isCompose },
	);
	const databaseQuery = api.database.one.useQuery(
		{ databaseId: id },
		{ enabled: !!id && !isApplication && !isCompose },
	);
	const { data } = isApplication
		? applicationQuery
		: isCompose
			? composeQuery
			: databaseQuery;

	const applicationMutation = api.application.delete.useMutation();
	const composeMutation = api.compose.delete.useMutation();
	const databaseMutation = api.database.remove.useMutation();
	const { mutateAsync, isPending } = isApplication
		? applicationMutation
		: isCompose
			? composeMutation
			: databaseMutation;
	const { push } = useRouter();
	const form = useForm<DeleteCompose>({
		defaultValues: {
			projectName: "",
			deleteVolumes: false,
		},
		resolver: zodResolver(deleteComposeSchema),
	});

	const onSubmit = async (formData: DeleteCompose) => {
		const expectedName = `${data?.name}/${data?.appName}`;
		if (formData.projectName === expectedName) {
			const { deleteVolumes } = formData;
			await mutateAsync({
				databaseId: id,
				applicationId: id || "",
				composeId: id || "",
				deleteVolumes,
			})
				.then((result) => {
					if (
						result?.environment?.workspaceId &&
						result.environment.environmentId
					) {
						push(
							workspaceEnvironmentPath({
								workspaceId: result.environment.workspaceId,
								environmentId: result.environment.environmentId,
							}),
						);
					}
					toast.success("Service deleted successfully");
					setIsOpen(false);
				})
				.catch((err) => {
					logger.error("Failed to delete the service", err);
					toast.error("Error deleting the service");
				});
		} else {
			form.setError("projectName", {
				message: `Workspace name must match "${expectedName}"`,
			});
		}
	};

	const isDisabled =
		(data &&
			"applicationStatus" in data &&
			data?.applicationStatus === "running") ||
		(data && "composeStatus" in data && data?.composeStatus === "running");

	if (!canDelete) return null;

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Delete service"
						variant="ghost"
						shape="square"
						className="group hover:bg-kumo-danger/10 "
						loading={isPending}
					>
						<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Are you absolutely sure?</Dialog.Title>
					<Dialog.Description>
						This action cannot be undone. This will permanently delete the
						service. If you are sure please enter the service name to delete
						this service.
					</Dialog.Description>
				</div>
				<div className="grid gap-4">
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							id="hook-form-delete-compose"
							className="grid w-full gap-4"
						>
							<FormField
								control={form.control}
								name="projectName"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="flex items-center gap-2">
											<span>
												To confirm, type{" "}
												<Button
													type="button"
													className="p-2 rounded-md ml-1 mr-1 hover:border-kumo-brand hover:text-kumo-inverse hover:bg-kumo-brand hover:cursor-pointer"
													variant="outline"
													size="xs"
													onClick={() => {
														if (data?.name && data?.appName) {
															copy(`${data.name}/${data.appName}`);
															toast.success("Copied to clipboard. Be careful!");
														}
													}}
												>
													{data?.name}/{data?.appName}&nbsp;
													<Copy className="h-4 w-4 ml-1 text-kumo-subtle" />
												</Button>{" "}
												in the box below:
											</span>
										</FormLabel>
										<FormControl>
											<Input
												placeholder="Enter compose name to confirm"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{type === "compose" && (
								<FormField
									control={form.control}
									name="deleteVolumes"
									render={({ field }) => (
										<FormItem>
											<div className="flex items-center">
												<FormControl>
													<Checkbox
														checked={field.value}
														onCheckedChange={field.onChange}
													/>
												</FormControl>

												<FormLabel className="ml-2">
													Delete volumes associated with this compose
												</FormLabel>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}
						</form>
					</Form>
				</div>
				{isDisabled && (
					<AlertBlock type="warning" className="w-full mt-5">
						Cannot delete the service while it is running. Please wait for the
						build to finish and then try again.
					</AlertBlock>
				)}
				<div>
					<Button
						variant="secondary"
						onClick={() => {
							setIsOpen(false);
						}}
					>
						Cancel
					</Button>

					<Button
						loading={isPending}
						disabled={isDisabled}
						form="hook-form-delete-compose"
						type="submit"
						variant="destructive"
					>
						Confirm
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
