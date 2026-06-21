import { Copy, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Radio } from "@cloudflare/kumo/primitives/radio";
import { RadioGroup } from "@cloudflare/kumo/primitives/radio-group";
import { Select } from "@cloudflare/kumo/components/select";

export type Services = {
	serverId?: string | null;
	name: string;
	type:
		| "application"
		| "compose"
		| "libsql"
		| "mariadb"
		| "mongo"
		| "mysql"
		| "postgres"
		| "redis";
	description?: string | null;
	id: string;
	createdAt: string;
	status?: "idle" | "running" | "done" | "error";
};

interface DuplicateProjectProps {
	environmentId: string;
	services: Services[];
	selectedServiceIds: string[];
}

export const DuplicateProject = ({
	environmentId,
	services,
	selectedServiceIds,
}: DuplicateProjectProps) => {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [duplicateType, setDuplicateType] = useState("new-project"); // "new-project" or "existing-environment"
	const [selectedTargetProject, setSelectedTargetProject] =
		useState<string>("");
	const [selectedTargetEnvironment, setSelectedTargetEnvironment] =
		useState<string>("");
	const utils = api.useUtils();
	const router = useRouter();
	const params = useParams<{ projectId?: string }>();

	// Queries for project and environment selection
	const { data: allProjects } = api.project.all.useQuery();
	const { data: selectedProjectEnvironments } =
		api.environment.byProjectId.useQuery(
			{ projectId: selectedTargetProject },
			{ enabled: !!selectedTargetProject },
		);

	const selectedServices = services.filter((service) =>
		selectedServiceIds.includes(service.id),
	);

	const { mutateAsync: duplicateProject, isPending } =
		api.project.duplicate.useMutation({
			onSuccess: async (newProject) => {
				await utils.project.all.invalidate();

				// If duplicating to same project+environment, invalidate the environment query
				// to refresh the services list
				if (duplicateType === "existing-environment") {
					await utils.environment.one.invalidate({
						environmentId: selectedTargetEnvironment,
					});
					await utils.environment.byProjectId.invalidate({
						projectId: selectedTargetProject,
					});

					// If duplicating to the same environment we're currently viewing,
					// also invalidate the current environment to refresh the services list
					if (selectedTargetEnvironment === environmentId) {
						await utils.environment.one.invalidate({ environmentId });
						// Also invalidate the project query to refresh the project data
						const projectId = params?.projectId;
						if (projectId) {
							await utils.project.one.invalidate({ projectId });
						}
					}
				}

				toast.success(
					duplicateType === "new-project"
						? "Project duplicated successfully"
						: "Services duplicated successfully",
				);
				setOpen(false);
				if (duplicateType === "new-project") {
					router.push(
						`/dashboard/project/${newProject?.projectId}/environment/${newProject?.environmentId}`,
					);
				}
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});

	const handleDuplicate = async () => {
		if (duplicateType === "new-project" && !name) {
			toast.error("Project name is required");
			return;
		}

		if (duplicateType === "existing-environment") {
			if (!selectedTargetProject) {
				toast.error("Please select a target project");
				return;
			}
			if (!selectedTargetEnvironment) {
				toast.error("Please select a target environment");
				return;
			}
		}

		// TODO: Update duplicate API to support targetProjectId and targetEnvironmentId
		await duplicateProject({
			sourceEnvironmentId: selectedTargetEnvironment,
			name,
			description,
			includeServices: true,
			selectedServices: selectedServices.map((service) => ({
				id: service.id,
				type: service.type,
			})),
			duplicateInSameProject: duplicateType === "existing-environment",
		});
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(isOpen) => {
				setOpen(isOpen);
				if (!isOpen) {
					// Reset form when closing
					setName("");
					setDescription("");
					setDuplicateType("new-project");
					setSelectedTargetProject("");
					setSelectedTargetEnvironment("");
				}
			}}
		>
			<Dialog.Trigger render={(

				<Button variant="ghost" className="w-full justify-start">
					<Copy className="mr-2 h-4 w-4" />
					Duplicate
				</Button>
			
)} />
			<Dialog>
				<div>
					<Dialog.Title>Duplicate Services</Dialog.Title>
					<Dialog.Description>
						Choose where to duplicate the selected services
					</Dialog.Description>
				</div>

				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label>Duplicate to</Label>
						<RadioGroup
							value={duplicateType}
							onValueChange={(value) => {
								if (value === null) return;
								setDuplicateType(value);
								// Reset selections when changing type
								if (value !== "existing-environment") {
									setSelectedTargetProject("");
									setSelectedTargetEnvironment("");
								}
							}}
							className="grid gap-2"
						>
							<div className="flex items-center space-x-2">
								<Radio.Root value="new-project" id="new-project" />
								<Label htmlFor="new-project">New project</Label>
							</div>
							<div className="flex items-center space-x-2">
								<Radio.Root
									value="existing-environment"
									id="existing-environment"
								/>
								<Label htmlFor="existing-environment">
									Existing environment
								</Label>
							</div>
						</RadioGroup>
					</div>

					{duplicateType === "new-project" && (
						<>
							<div className="grid gap-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="New project name"
								/>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="description">Description</Label>
								<Input
									id="description"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Project description (optional)"
								/>
							</div>
						</>
					)}

					{duplicateType === "existing-environment" && (
						<>
							{allProjects?.filter((p) => p.projectId !== environmentId)
								.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
									<p className="text-sm text-muted-foreground">
										No other projects available. Create a new project first.
									</p>
								</div>
							) : (
								<>
									{/* Step 1: Select Project */}
									<div className="grid gap-2">
										<Label>Target Project</Label>
										<Select aria-label="Select option"
											value={selectedTargetProject}
											onValueChange={(value) => {
												if (value === null) return;
												setSelectedTargetProject(value);
												setSelectedTargetEnvironment(""); // Reset environment when project changes
											}}
										>
											<>
												
											</>
											<>
												{allProjects
													?.filter((p) => p.projectId !== environmentId)
													.map((project) => (
														<Select.Option
															key={project.projectId}
															value={project.projectId}
														>
															{project.name}
														</Select.Option>
													))}
											</>
										</Select>
									</div>

									{/* Step 2: Select Environment (only show if project is selected) */}
									{selectedTargetProject && (
										<div className="grid gap-2">
											<Label>Target Environment</Label>
											<Select aria-label="Select option"
												value={selectedTargetEnvironment}
												onValueChange={(value) => value !== null && setSelectedTargetEnvironment(value as never)}
											>
												<>
													
												</>
												<>
													{selectedProjectEnvironments?.map((env) => (
														<Select.Option
															key={env.environmentId}
															value={env.environmentId}
														>
															{env.name}
														</Select.Option>
													))}
												</>
											</Select>
										</div>
									)}
								</>
							)}
						</>
					)}

					<div className="grid gap-2">
						<Label>Selected services to duplicate</Label>
						<div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-4">
							{selectedServices.map((service) => (
								<div key={service.id} className="flex items-center space-x-2">
									<span className="text-sm">
										{service.name} ({service.type})
									</span>
								</div>
							))}
						</div>
					</div>
				</div>

				<div>
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleDuplicate}
						disabled={
							isPending ||
							(duplicateType === "new-project" && !name) ||
							(duplicateType === "existing-environment" &&
								(!selectedTargetProject || !selectedTargetEnvironment))
						}
					>
						{isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								{duplicateType === "new-project"
									? "Duplicating to new project..."
									: "Duplicating to environment..."}
							</>
						) : duplicateType === "new-project" ? (
							"Duplicate to new project"
						) : (
							"Duplicate to environment"
						)}
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
