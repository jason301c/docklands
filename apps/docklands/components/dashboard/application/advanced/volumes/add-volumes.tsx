import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Radio } from "@cloudflare/kumo/components/radio";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PlusIcon } from "lucide-react";
import type React from "react";
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
import { cn } from "@/shared/utils";

interface Props {
	serviceId: string;
	serviceType:
		| "application"
		| "compose"
		| "libsql"
		| "mariadb"
		| "mongo"
		| "mysql"
		| "postgres"
		| "redis";
	refetch: () => void;
	children?: React.ReactNode;
}

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
			filePath: z.string().min(1, "File path required"),
			content: z.string().optional(),
		})
		.merge(mountSchema),
]);

type AddMount = z.infer<typeof mySchema>;

export const AddVolumes = ({
	serviceId,
	serviceType,
	refetch,
	children = <PlusIcon className="h-4 w-4" />,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const { mutateAsync } = api.mounts.create.useMutation();
	const form = useForm<AddMount>({
		defaultValues: {
			type: serviceType === "compose" ? "file" : "bind",
			hostPath: "",
			mountPath: serviceType === "compose" ? "/" : "",
		},
		resolver: zodResolver(mySchema),
	});
	const type = form.watch("type");

	useEffect(() => {
		form.reset();
	}, [form, form.reset, form.formState.isSubmitSuccessful]);

	const onSubmit = async (data: AddMount) => {
		if (data.type === "bind") {
			await mutateAsync({
				serviceId,
				hostPath: data.hostPath,
				mountPath: data.mountPath,
				type: data.type,
				serviceType,
			})
				.then(() => {
					toast.success("Mount Created");
					setIsOpen(false);
				})
				.catch(() => {
					toast.error("Error creating the Bind mount");
				});
		} else if (data.type === "volume") {
			await mutateAsync({
				serviceId,
				volumeName: data.volumeName,
				mountPath: data.mountPath,
				type: data.type,
				serviceType,
			})
				.then(() => {
					toast.success("Mount Created");
					setIsOpen(false);
				})
				.catch(() => {
					toast.error("Error creating the Volume mount");
				});
		} else if (data.type === "file") {
			await mutateAsync({
				serviceId,
				content: data.content,
				mountPath: data.mountPath,
				filePath: data.filePath,
				type: data.type,
				serviceType,
			})
				.then(() => {
					toast.success("Mount Created");
					setIsOpen(false);
				})
				.catch(() => {
					toast.error("Error creating the File mount");
				});
		}

		refetch();
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger className="" render={<Button>{children}</Button>} />
			<Dialog className="sm:max-w-3xl">
				<div>
					<Dialog.Title>Volumes / Mounts</Dialog.Title>
				</div>
				{/* {isError && (
        <div className="flex items-center flex-row gap-4 rounded-lg bg-red-50 p-2 dark:bg-red-950">
          <AlertTriangle className="text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-600 dark:text-red-400">
            {error?.message}
          </span>
        </div>
      )} */}

				<Form {...form}>
					<form
						id="hook-form-volume"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-8 "
					>
						{type === "bind" && (
							<AlertBlock>
								<div className="space-y-2">
									<p>
										Make sure the host path is a valid path and exists in the
										host machine.
									</p>
									<p className="text-sm text-muted-foreground">
										<strong>Cluster Warning:</strong> If you're using cluster
										features, bind mounts may cause build failures since the
										path must exist on all worker/manager nodes. Consider using
										external tools to distribute the folder across nodes or use
										named volumes instead.
									</p>
								</div>
							</AlertBlock>
						)}
						<FormField
							control={form.control}
							defaultValue={form.control._defaultValues.type}
							name="type"
							render={({ field }) => (
								<FormItem className="space-y-3">
									<FormLabel className="text-muted-foreground">
										Select the Mount Type
									</FormLabel>
									<FormControl>
										<Radio.Group
											onValueChange={field.onChange}
											defaultValue={field.value}
											orientation="horizontal"
											appearance="card"
											className="w-full"
										>
											<Radio.Legend className="sr-only">
												Select the mount type
											</Radio.Legend>
											{serviceType !== "compose" && (
												<Radio.Item value="bind" label="Bind Mount" />
											)}

											{serviceType !== "compose" && (
												<Radio.Item value="volume" label="Volume Mount" />
											)}

											<Radio.Item
												value="file"
												label="File Mount"
												className={cn(
													serviceType === "compose" && "sm:col-span-2",
												)}
											/>
										</Radio.Group>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex flex-col gap-4">
							<FormLabel className="text-lg font-semibold leading-none tracking-tight">
								Fill the next fields.
							</FormLabel>
							<div className="flex flex-col gap-2">
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
												<FormItem className="max-w-full max-w-[45rem]">
													<FormLabel>Content</FormLabel>
													<FormControl>
														<FormControl>
															<CodeEditor
																language="properties"
																placeholder={`NODE_ENV=production
PORT=3000
`}
																className="h-96 font-mono "
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
														<FormControl>
															<Input
																placeholder="Name of the file"
																{...field}
															/>
														</FormControl>
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
						</div>
					</form>

					<div>
						<Button
							loading={form.formState.isSubmitting}
							form="hook-form-volume"
							type="submit"
						>
							Create
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
