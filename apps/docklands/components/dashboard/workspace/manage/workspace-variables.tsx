import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { FileIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
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

const logger = createClientLogger("workspace");

const updateWorkspaceSchema = z.object({
	env: z.string().optional(),
});

type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>;

interface Props {
	workspaceId: string;
	children?: React.ReactNode;
}

export const WorkspaceVariables = ({ workspaceId, children }: Props) => {
	const { permissions } = usePermissions();
	const canRead = permissions?.workspaceEnvVars.read ?? false;
	const canWrite = permissions?.workspaceEnvVars.write ?? false;
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();
	const { mutateAsync, error, isError, isPending } =
		api.workspaces.update.useMutation();
	const { data } = api.workspaces.one.useQuery(
		{
			workspaceId,
		},
		{
			enabled: !!workspaceId,
		},
	);

	const form = useForm<UpdateWorkspace>({
		defaultValues: {
			env: data?.env ?? "",
		},
		resolver: zodResolver(updateWorkspaceSchema),
	});
	useEffect(() => {
		if (data) {
			form.reset({
				env: data.env ?? "",
			});
		}
	}, [data, form, form.reset]);

	const onSubmit = async (formData: UpdateWorkspace) => {
		await mutateAsync({
			env: formData.env || "",
			workspaceId: workspaceId,
		})
			.then(() => {
				toast.success("Workspace variables updated");
				utils.workspaces.all.invalidate();
			})
			.catch((err) => {
				logger.error("Error updating workspace variables", err);
				toast.error("Error updating workspace variables");
			});
	};

	// Add keyboard shortcut for Ctrl+S/Cmd+S
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				(e.ctrlKey || e.metaKey) &&
				e.code === "KeyS" &&
				!isPending &&
				isOpen
			) {
				e.preventDefault();
				form.handleSubmit(onSubmit)();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [form, onSubmit, isPending, isOpen]);

	if (!canRead) {
		return null;
	}

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					(children ?? (
						<DropdownMenu.Item
							className="w-full cursor-pointer space-x-3"
							onSelect={(e) => e.preventDefault()}
						>
							<FileIcon className="size-4" />
							<span>Workspace variables</span>
						</DropdownMenu.Item>
					)) as never
				}
			/>
			<Dialog className="sm:max-w-6xl">
				<Dialog.Header>
					<Dialog.Title>Workspace variables</Dialog.Title>
					<Dialog.Description>
						Update variables that are accessible to every service in this
						workspace.
					</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<AlertBlock type="info">
					Use this syntax to reference workspace-level variables in your service
					environments:{" "}
					<code>DATABASE_URL=${"{{workspace.DATABASE_URL}}"}</code>
				</AlertBlock>
				<div className="grid gap-4">
					<div className="grid items-center gap-4">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="grid w-full gap-4 "
							>
								<FormField
									control={form.control}
									name="env"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Environment variables</FormLabel>
											<FormControl>
												<CodeEditor
													lineWrapping
													language="properties"
													readOnly={!canWrite}
													wrapperClassName="h-[35rem] font-mono"
													placeholder={`NODE_ENV=production
PORT=3000

                                                    `}
													{...field}
												/>
											</FormControl>

											<pre>
												<FormMessage />
											</pre>
										</FormItem>
									)}
								/>
								{canWrite && (
									<Dialog.Footer>
										<Button loading={isPending} type="submit">
											Update
										</Button>
									</Dialog.Footer>
								)}
							</form>
						</Form>
					</div>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
