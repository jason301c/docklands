import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { PlusIcon, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { TagSelector } from "@/components/shared/tag-selector";
import { toast } from "@/components/shared/toast";
import { workspaceEnvironmentPath } from "@/shared/routes";

const WorkspaceSchema = z.object({
	name: z
		.string()
		.min(1, "Workspace name is required")
		.refine(
			(name) => {
				const trimmedName = name.trim();
				const validNameRegex =
					/^[\p{L}\p{N}_-][\p{L}\p{N}\s_.-]*[\p{L}\p{N}_-]$/u;
				return validNameRegex.test(trimmedName);
			},
			{
				message:
					"Workspace name must start and end with a letter, number, hyphen or underscore. Spaces are allowed in between.",
			},
		)
		.refine((name) => !/^\d/.test(name.trim()), {
			message: "Workspace name cannot start with a number",
		})
		.transform((name) => name.trim()),
	description: z.string().optional(),
});

type WorkspaceForm = z.infer<typeof WorkspaceSchema>;

interface Props {
	projectId?: string;
}

export const HandleWorkspace = ({ projectId }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

	const { mutateAsync, error, isError } = projectId
		? api.project.update.useMutation()
		: api.project.create.useMutation();

	const { data, refetch } = api.project.one.useQuery(
		{
			projectId: projectId || "",
		},
		{
			enabled: !!projectId,
		},
	);

	const { data: availableTags = [] } = api.tag.all.useQuery();
	const bulkAssignMutation = api.tag.bulkAssign.useMutation();

	const router = useRouter();
	const form = useForm<WorkspaceForm>({
		defaultValues: {
			description: "",
			name: "",
		},
		resolver: standardSchemaResolver(WorkspaceSchema),
	});

	useEffect(() => {
		form.reset({
			description: data?.description ?? "",
			name: data?.name ?? "",
		});
		// Load existing tags when editing a project
		if (data?.projectTags) {
			const tagIds = data.projectTags.map((pt) => pt.tagId);
			setSelectedTagIds(tagIds);
		} else {
			setSelectedTagIds([]);
		}
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	const onSubmit = async (data: WorkspaceForm) => {
		await mutateAsync({
			name: data.name,
			description: data.description,
			projectId: projectId || "",
		})
			.then(async (data) => {
				// Assign tags to the workspace (both create and update).
				const projectIdToUse =
					projectId ||
					(data && "project" in data ? data.project.projectId : undefined);

				if (projectIdToUse) {
					try {
						await bulkAssignMutation.mutateAsync({
							projectId: projectIdToUse,
							tagIds: selectedTagIds,
						});
					} catch (error) {
						toast.error("Failed to assign tags to workspace");
					}
				}

				await utils.project.all.invalidate();
				toast.success(projectId ? "Workspace updated" : "Workspace created");
				setIsOpen(false);
				if (!projectId) {
					const environmentIdToUse =
						data && "environment" in data
							? data.environment.environmentId
							: undefined;

					if (environmentIdToUse && projectIdToUse) {
						router.push(
							workspaceEnvironmentPath({
								projectId: projectIdToUse,
								environmentId: environmentIdToUse,
							}),
						);
					}
				} else {
					refetch();
				}
			})
			.catch(() => {
				toast.error(
					projectId
						? "Error updating this workspace"
						: "Error creating this workspace",
				);
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					projectId ? (
						<DropdownMenu.Item
							className="w-full cursor-pointer space-x-3"
							onSelect={(e) => e.preventDefault()}
						>
							<SquarePen className="size-4" />
							<span>Update</span>
						</DropdownMenu.Item>
					) : (
						((
							<Button>
								<PlusIcon className="h-4 w-4" />
								Create workspace
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:m:max-w-lg ">
				<div>
					<Dialog.Title>
						{projectId ? "Update workspace" : "Create workspace"}
					</Dialog.Title>
					<Dialog.Description>
						Group services, environments, and shared variables in one canvas.
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-project"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
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
						</div>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Description about this workspace..."
											className="resize-none"
											{...field}
										/>
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="space-y-2">
							<FormLabel>Tags</FormLabel>
							<TagSelector
								tags={availableTags.map((tag) => ({
									id: tag.tagId,
									name: tag.name,
									color: tag.color ?? undefined,
								}))}
								selectedTags={selectedTagIds}
								onTagsChange={setSelectedTagIds}
								placeholder="Select tags..."
							/>
						</div>
					</form>

					<div>
						<Button
							loading={form.formState.isSubmitting}
							form="hook-form-add-project"
							type="submit"
						>
							{projectId ? "Update" : "Create"}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
