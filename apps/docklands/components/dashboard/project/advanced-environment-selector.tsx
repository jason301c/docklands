import { ChevronDownIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Textarea } from "@cloudflare/kumo/components/input";
import type { findEnvironmentsByProjectId } from "@/server/core/services/environment";

type Environment = Awaited<
	ReturnType<typeof findEnvironmentsByProjectId>
>[number];
interface AdvancedEnvironmentSelectorProps {
	projectId: string;
	currentEnvironmentId?: string;
}

export const AdvancedEnvironmentSelector = ({
	projectId,
	currentEnvironmentId,
}: AdvancedEnvironmentSelectorProps) => {
	const router = useRouter();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [selectedEnvironment, setSelectedEnvironment] =
		useState<Environment | null>(null);

	const { data: environments } = api.environment.byProjectId.useQuery(
		{ projectId: projectId },
		{
			enabled: !!projectId,
		},
	);

	// Form states
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	// Get current user's permissions
	const { data: permissions } = api.user.getPermissions.useQuery();

	// Check if user can create environments
	const canCreateEnvironments = !!permissions?.environment.create;

	// Check if user can delete environments
	const canDeleteEnvironments = !!permissions?.environment.delete;

	const haveServices =
		selectedEnvironment &&
		((selectedEnvironment?.mariadb?.length || 0) > 0 ||
			(selectedEnvironment?.mongo?.length || 0) > 0 ||
			(selectedEnvironment?.mysql?.length || 0) > 0 ||
			(selectedEnvironment?.postgres?.length || 0) > 0 ||
			(selectedEnvironment?.redis?.length || 0) > 0 ||
			(selectedEnvironment?.applications?.length || 0) > 0 ||
			(selectedEnvironment?.compose?.length || 0) > 0);
	const createEnvironment = api.environment.create.useMutation();
	const updateEnvironment = api.environment.update.useMutation();
	const deleteEnvironment = api.environment.remove.useMutation();
	const duplicateEnvironment = api.environment.duplicate.useMutation();

	// Refetch project data
	const utils = api.useUtils();

	const handleCreateEnvironment = async () => {
		try {
			await createEnvironment.mutateAsync({
				projectId,
				name: name.trim(),
				description: description.trim() || undefined,
			});

			toast.success("Environment created successfully");
			utils.environment.byProjectId.invalidate({ projectId });
			// Invalidate the project query to refresh the project data for the advance-breadcrumb
			utils.project.all.invalidate();
			setIsCreateDialogOpen(false);
			setName("");
			setDescription("");
		} catch (error) {
			toast.error(
				`Failed to create environment: ${error instanceof Error ? error.message : error}`,
			);
		}
	};

	const handleUpdateEnvironment = async () => {
		if (!selectedEnvironment) return;

		try {
			await updateEnvironment.mutateAsync({
				environmentId: selectedEnvironment.environmentId,
				name: name.trim(),
				description: description.trim() || undefined,
			});

			toast.success("Environment updated successfully");
			utils.environment.byProjectId.invalidate({ projectId });
			setIsEditDialogOpen(false);
			setSelectedEnvironment(null);
			setName("");
			setDescription("");
		} catch (error) {
			toast.error(
				`Failed to update environment: ${error instanceof Error ? error.message : error}`,
			);
		}
	};

	const handleDeleteEnvironment = async () => {
		if (!selectedEnvironment) return;

		try {
			await deleteEnvironment.mutateAsync({
				environmentId: selectedEnvironment.environmentId,
			});

			toast.success("Environment deleted successfully");
			utils.environment.byProjectId.invalidate({ projectId });
			setIsDeleteDialogOpen(false);
			setSelectedEnvironment(null);

			// Redirect to first available environment if we deleted the current environment
			if (selectedEnvironment.environmentId === currentEnvironmentId) {
				const firstEnv = environments?.find(
					(env) => env.environmentId !== selectedEnvironment.environmentId,
				);
				if (firstEnv) {
					router.push(
						`/dashboard/project/${projectId}/environment/${firstEnv.environmentId}`,
					);
				} else {
					// No other environments, redirect to project page
					router.push(`/dashboard/project/${projectId}`);
				}
			}
		} catch (error) {
			toast.error("Failed to delete environment");
		}
	};

	const handleDuplicateEnvironment = async (environment: Environment) => {
		try {
			const result = await duplicateEnvironment.mutateAsync({
				environmentId: environment.environmentId,
				name: `${environment.name}-copy`,
				description: environment.description || undefined,
			});

			toast.success("Environment duplicated successfully");
			utils.project.one.invalidate({ projectId });

			// Navigate to the new duplicated environment
			router.push(
				`/dashboard/project/${projectId}/environment/${result.environmentId}`,
			);
		} catch (error) {
			toast.error("Failed to duplicate environment");
		}
	};

	const openEditDialog = (environment: Environment) => {
		setSelectedEnvironment(environment);
		setName(environment.name);
		setDescription(environment.description || "");
		setIsEditDialogOpen(true);
	};

	const openDeleteDialog = (environment: Environment) => {
		setSelectedEnvironment(environment);
		setIsDeleteDialogOpen(true);
	};

	const currentEnv = environments?.find(
		(env) => env.environmentId === currentEnvironmentId,
	);

	return (
		<>
			<DropdownMenu>
				<DropdownMenu.Trigger render={(

					<Button variant="ghost" className="h-auto p-2 font-normal">
						<div className="flex items-center gap-1">
							<span className="text-muted-foreground">/</span>
							<span>{currentEnv?.name || "Select Environment"}</span>
							<ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
						</div>
					</Button>
				
)} />
				<DropdownMenu.Content className="w-[300px]" align="start">
					<DropdownMenu.Label>Environments</DropdownMenu.Label>
					<DropdownMenu.Separator />

					{environments?.map((environment) => {
						const servicesCount =
							environment.mariadb.length +
							environment.mongo.length +
							environment.mysql.length +
							environment.postgres.length +
							environment.redis.length +
							environment.applications.length +
							environment.compose.length;
						return (
							<div
								key={environment.environmentId}
								className="flex items-center"
							>
								<DropdownMenu.Item
									className="flex-1 cursor-pointer"
									onClick={() => {
										router.push(
											`/dashboard/project/${projectId}/environment/${environment.environmentId}`,
										);
									}}
								>
									<div className="flex items-center justify-between w-full">
										<span>
											{environment.name} ({servicesCount})
										</span>
										{environment.environmentId === currentEnvironmentId && (
											<div className="w-2 h-2 bg-blue-500 rounded-full" />
										)}
									</div>
								</DropdownMenu.Item>
								<div className="flex items-center gap-1 px-2">
									{!environment.isDefault && (
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0"
											onClick={(e) => {
												e.stopPropagation();
												openEditDialog(environment);
											}}
										>
											<PencilIcon className="h-3 w-3" />
										</Button>
									)}
									{canDeleteEnvironments && !environment.isDefault && (
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
											onClick={(e) => {
												e.stopPropagation();
												openDeleteDialog(environment);
											}}
										>
											<TrashIcon className="h-3 w-3" />
										</Button>
									)}
								</div>
							</div>
						);
					})}

					<DropdownMenu.Separator />
					{canCreateEnvironments && (
						<DropdownMenu.Item
							className="cursor-pointer"
							onClick={() => setIsCreateDialogOpen(true)}
						>
							<PlusIcon className="h-4 w-4 mr-2" />
							Create Environment
						</DropdownMenu.Item>
					)}
				</DropdownMenu.Content>
			</DropdownMenu>

			<Dialog.Root open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<Dialog>
					<div>
						<Dialog.Title>Create Environment</Dialog.Title>
						<Dialog.Description>
							Create a new environment for your project.
						</Dialog.Description>
					</div>

					<div className="space-y-4">
						<div className="space-y-1">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Environment name"
							/>
						</div>
						<div className="space-y-1">
							<Label htmlFor="description">Description (optional)</Label>
							<Textarea
								id="description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Environment description"
							/>
						</div>
					</div>

					<div>
						<Button
							variant="outline"
							onClick={() => {
								setIsCreateDialogOpen(false);
								setName("");
								setDescription("");
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateEnvironment}
							disabled={!name.trim() || createEnvironment.isPending}
						>
							{createEnvironment.isPending ? "Creating..." : "Create"}
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>

			{/* Edit Environment Dialog */}
			<Dialog.Root open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<Dialog>
					<div>
						<Dialog.Title>Edit Environment</Dialog.Title>
						<Dialog.Description>
							Update the environment details.
						</Dialog.Description>
					</div>

					<div className="space-y-4">
						<div className="space-y-1">
							<Label htmlFor="edit-name">Name</Label>
							<Input
								id="edit-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Environment name"
							/>
						</div>
						<div className="space-y-1">
							<Label htmlFor="edit-description">Description (optional)</Label>
							<Textarea
								id="edit-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Environment description"
							/>
						</div>
					</div>

					<div>
						<Button
							variant="outline"
							onClick={() => {
								setIsEditDialogOpen(false);
								setSelectedEnvironment(null);
								setName("");
								setDescription("");
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleUpdateEnvironment}
							disabled={!name.trim() || updateEnvironment.isPending}
						>
							{updateEnvironment.isPending ? "Updating..." : "Update"}
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>

			{/* Delete Environment Dialog */}
			<Dialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<Dialog>
					<div>
						<Dialog.Title>Delete Environment</Dialog.Title>
						<Dialog.Description>
							Are you sure you want to delete the environment "
							{selectedEnvironment?.name}"? This action cannot be undone and
							will also delete all services in this environment.
						</Dialog.Description>
					</div>

					{haveServices && (
						<AlertBlock type="warning">
							This environment have active services, please delete them first.
						</AlertBlock>
					)}

					<div>
						<Button
							variant="outline"
							onClick={() => {
								setIsDeleteDialogOpen(false);
								setSelectedEnvironment(null);
							}}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteEnvironment}
							disabled={
								deleteEnvironment.isPending ||
								haveServices ||
								!selectedEnvironment
							}
						>
							{deleteEnvironment.isPending ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</>
	);
};
