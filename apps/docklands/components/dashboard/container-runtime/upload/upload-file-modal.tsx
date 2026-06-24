import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Upload } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "@/client/api/trpc";
import { Dialog } from "@/components/shared/dialog";
import { Dropzone } from "@/components/shared/dropzone";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import {
	type UploadFileToContainer,
	uploadFileToContainerSchema,
} from "@/shared/validation/schema";

interface Props {
	containerId: string;
	runtimeWorkerId?: string;
	children?: React.ReactNode;
}

export const UploadFileModal = ({
	children,
	containerId,
	runtimeWorkerId,
}: Props) => {
	const [open, setOpen] = useState(false);

	const { mutateAsync: uploadFile, isPending: isLoading } =
		api.docker.uploadFileToContainer.useMutation({
			onSuccess: () => {
				toast.success("File uploaded successfully");
				setOpen(false);
				form.reset();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to upload file to container");
			},
		});

	const form = useForm({
		resolver: zodResolver(uploadFileToContainerSchema),
		defaultValues: {
			containerId,
			destinationPath: "/",
			runtimeWorkerId: runtimeWorkerId || undefined,
		},
	});

	const file = form.watch("file");

	const onSubmit = async (values: UploadFileToContainer) => {
		if (!values.file) {
			toast.error("Please select a file to upload");
			return;
		}

		const formData = new FormData();
		formData.append("containerId", values.containerId);
		formData.append("file", values.file);
		formData.append("destinationPath", values.destinationPath);
		if (values.runtimeWorkerId) {
			formData.append("runtimeWorkerId", values.runtimeWorkerId);
		}

		await uploadFile(formData);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				nativeButton={false}
				render={
					<DropdownMenu.Item
						className="w-full cursor-pointer space-x-3"
						onSelect={(e) => e.preventDefault()}
					>
						{children}
					</DropdownMenu.Item>
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<Dialog.Header>
					<Dialog.Title className="flex items-center gap-2">
						<Upload className="h-5 w-5" />
						Upload File to Container
					</Dialog.Title>
					<Dialog.Description>
						Upload a file directly into the container's filesystem
					</Dialog.Description>
				</Dialog.Header>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="destinationPath"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Destination Path</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="/path/to/file"
											className="font-mono"
										/>
									</FormControl>
									<FormMessage />
									<p className="text-xs text-kumo-subtle">
										Enter the full path where the file should be uploaded in the
										container (e.g., /app/config.json)
									</p>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="file"
							render={({ field }) => (
								<FormItem>
									<FormLabel>File</FormLabel>
									<FormControl>
										<Dropzone
											{...field}
											dropMessage="Drop file here or click to browse"
											onChange={(files) => {
												if (files && files.length > 0) {
													field.onChange(files[0]);
												} else {
													field.onChange(null);
												}
											}}
										/>
									</FormControl>
									<FormMessage />
									{file instanceof File && (
										<div className="flex items-center gap-2 p-2 bg-kumo-fill rounded-md">
											<span className="text-sm text-kumo-subtle flex-1">
												{file.name} ({(file.size / 1024).toFixed(2)} KB)
											</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => field.onChange(null)}
											>
												Remove
											</Button>
										</div>
									)}
								</FormItem>
							)}
						/>

						<Dialog.Footer>
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								loading={isLoading}
								disabled={!file || isLoading}
							>
								Upload File
							</Button>
						</Dialog.Footer>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
