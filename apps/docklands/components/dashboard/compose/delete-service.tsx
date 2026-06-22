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
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canDelete = permissions?.service.delete ?? false;
	const [isOpen, setIsOpen] = useState(false);

	const queryMap = {
		postgres: () =>
			api.postgres.one.useQuery({ postgresId: id }, { enabled: !!id }),
		redis: () => api.redis.one.useQuery({ redisId: id }, { enabled: !!id }),
		mysql: () => api.mysql.one.useQuery({ mysqlId: id }, { enabled: !!id }),
		mariadb: () =>
			api.mariadb.one.useQuery({ mariadbId: id }, { enabled: !!id }),
		libsql: () => api.libsql.one.useQuery({ libsqlId: id }, { enabled: !!id }),
		application: () =>
			api.application.one.useQuery({ applicationId: id }, { enabled: !!id }),
		mongo: () => api.mongo.one.useQuery({ mongoId: id }, { enabled: !!id }),
		compose: () =>
			api.compose.one.useQuery({ composeId: id }, { enabled: !!id }),
	};
	const { data } = queryMap[type]
		? queryMap[type]()
		: api.mongo.one.useQuery({ mongoId: id }, { enabled: !!id });

	const mutationMap = {
		postgres: () => api.postgres.remove.useMutation(),
		redis: () => api.redis.remove.useMutation(),
		mysql: () => api.mysql.remove.useMutation(),
		mariadb: () => api.mariadb.remove.useMutation(),
		libsql: () => api.libsql.remove.useMutation(),
		application: () => api.application.delete.useMutation(),
		mongo: () => api.mongo.remove.useMutation(),
		compose: () => api.compose.delete.useMutation(),
	};
	const { mutateAsync, isPending } = mutationMap[type]
		? mutationMap[type]()
		: api.mongo.remove.useMutation();
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
				mongoId: id || "",
				postgresId: id || "",
				redisId: id || "",
				mysqlId: id || "",
				mariadbId: id || "",
				libsqlId: id || "",
				applicationId: id || "",
				composeId: id || "",
				deleteVolumes,
			})
				.then((result) => {
					if (
						result?.environment?.projectId &&
						result.environment.environmentId
					) {
						push(
							workspaceEnvironmentPath({
								projectId: result.environment.projectId,
								environmentId: result.environment.environmentId,
							}),
						);
					}
					toast.success("Service deleted successfully");
					setIsOpen(false);
				})
				.catch(() => {
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
						className="group hover:bg-red-500/10 "
						loading={isPending}
					>
						<Trash2 className="size-4 text-primary group-hover:text-red-500" />
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
													className="p-2 rounded-md ml-1 mr-1 hover:border-primary hover:text-primary-foreground hover:bg-primary hover:cursor-pointer"
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
													<Copy className="h-4 w-4 ml-1 text-muted-foreground" />
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
