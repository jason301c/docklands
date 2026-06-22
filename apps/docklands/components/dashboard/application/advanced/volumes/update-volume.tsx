import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const mountSchema = z.object({
	mountPath: z.string().min(1, "Mount path required"),
});

const mySchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("bind"),
			hostPath: z.string().min(1, "Host path required"),
		})
		.merge(mountSchema),
	z
		.object({
			type: z.literal("volume"),
			volumeName: z
				.string()
				.min(1, "Volume name required")
				.regex(
					/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
					"Invalid volume name. Use letters, numbers, '._-' and start with a letter/number.",
				),
		})
		.merge(mountSchema),
	z
		.object({
			type: z.literal("file"),
			content: z.string().optional(),
			filePath: z.string().min(1, "File path required"),
		})
		.merge(mountSchema),
]);

type UpdateMount = z.infer<typeof mySchema>;

interface Props {
	mountId: string;
	type: "bind" | "volume" | "file";
	refetch: () => void;
	serviceType:
		| "application"
		| "compose"
		| "libsql"
		| "mariadb"
		| "mongo"
		| "mysql"
		| "postgres"
		| "redis";
}

export const UpdateVolume = ({
	mountId,
	type,
	refetch,
	serviceType,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const _utils = api.useUtils();
	const { data } = api.mounts.one.useQuery(
		{
			mountId,
		},
		{
			enabled: !!mountId,
		},
	);

	const { mutateAsync, isPending, error, isError } =
		api.mounts.update.useMutation();

	const form = useForm<UpdateMount>({
		defaultValues: {
			type,
			hostPath: "",
			mountPath: "",
		},
		resolver: zodResolver(mySchema),
	});

	const typeForm = form.watch("type");

	useEffect(() => {
		if (data) {
			if (typeForm === "bind") {
				form.reset({
					hostPath: data.hostPath || "",
					mountPath: data.mountPath,
					type: "bind",
				});
			} else if (typeForm === "volume") {
				form.reset({
					volumeName: data.volumeName || "",
					mountPath: data.mountPath,
					type: "volume",
				});
			} else if (typeForm === "file") {
				form.reset({
					content: data.content || "",
					mountPath: serviceType === "compose" ? "/" : data.mountPath,
					filePath: data.filePath || "",
					type: "file",
				});
			}
		}
	}, [form, form.reset, data]);

	const onSubmit = async (data: UpdateMount) => {
		if (data.type === "bind") {
			await mutateAsync({
				hostPath: data.hostPath,
				mountPath: data.mountPath,
				type: data.type,
				mountId,
			})
				.then(() => {
					toast.success("Mount Update");
					setIsOpen(false);
				})
				.catch(() => {
					toast.error("Error updating the Bind mount");
				});
		} else if (data.type === "volume") {
			await mutateAsync({
				volumeName: data.volumeName,
				mountPath: data.mountPath,
				type: data.type,
				mountId,
			})
				.then(() => {
					toast.success("Mount Update");
					setIsOpen(false);
				})
				.catch(() => {
					toast.error("Error updating the Volume mount");
				});
		} else if (data.type === "file") {
			await mutateAsync({
				content: data.content,
				mountPath: data.mountPath,
				type: data.type,
				filePath: data.filePath,
				mountId,
			})
				.then(() => {
					toast.success("Mount Update");
					setIsOpen(false);
				})
				.catch(() => {
					toast.error("Error updating the File mount");
				});
		}
		refetch();
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit volume"
						variant="ghost"
						shape="square"
						className="group hover:bg-blue-500/10 "
						loading={isPending}
					>
						<PenBoxIcon className="size-3.5  text-primary group-hover:text-blue-500" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-3xl">
				<div>
					<Dialog.Title>Update</Dialog.Title>
					<Dialog.Description>Update the mount</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				{type === "file" && (
					<AlertBlock type="warning">
						Updating the mount will recreate the file or directory.
					</AlertBlock>
				)}

				<Form {...form}>
					<form
						id="hook-form-update-volume"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
							{type === "bind" && (
								<FormField
									control={form.control}
									name="hostPath"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Host Path</FormLabel>
											<FormControl>
												<Input placeholder="Host Path" {...field} />
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
							)}
							{type === "volume" && (
								<FormField
									control={form.control}
									name="volumeName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Volume Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Volume Name"
													{...field}
													value={field.value || ""}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							{type === "file" && (
								<>
									<FormField
										control={form.control}
										name="content"
										render={({ field }) => (
											<FormItem className="w-full max-w-[45rem]">
												<FormLabel>Content</FormLabel>
												<FormControl>
													<FormControl>
														<CodeEditor
															language="properties"
															placeholder={`NODE_ENV=production
PORT=3000
`}
															className="h-96 font-mono w-full"
															{...field}
														/>
													</FormControl>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="filePath"
										render={({ field }) => (
											<FormItem>
												<FormLabel>File Path</FormLabel>
												<FormControl>
													<Input
														disabled
														placeholder="Name of the file"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</>
							)}
							{serviceType !== "compose" && (
								<FormField
									control={form.control}
									name="mountPath"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Mount Path (In the container)</FormLabel>
											<FormControl>
												<Input placeholder="Mount Path" {...field} />
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>
							)}
						</div>
						<div>
							<Button
								loading={isPending}
								// form="hook-form-update-volume"
								type="submit"
							>
								Update
							</Button>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
