"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import type { RouterOutputs } from "@/client/api/trpc";
import {
	getWorkspaceServiceKey,
	type WorkspaceService,
} from "@/shared/workspace-graph";
import { serviceTypeLabels } from "./constants";

type Workspace = RouterOutputs["workspaces"]["all"][number];
type Environment = RouterOutputs["environment"]["byWorkspaceId"][number];

export const DuplicateServicesDialog = ({
	open,
	onOpenChange,
	selectedBulkServices,
	allWorkspaces,
	duplicateMode,
	setDuplicateMode,
	duplicateName,
	setDuplicateName,
	duplicateDescription,
	setDuplicateDescription,
	duplicateTargetProject,
	setDuplicateTargetProject,
	duplicateTargetEnvironment,
	setDuplicateTargetEnvironment,
	duplicateProjectEnvironments,
	resetDuplicateDialog,
	runBulkDuplicate,
	isDuplicatePending,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedBulkServices: WorkspaceService[];
	allWorkspaces: Workspace[] | undefined;
	duplicateMode: "new-workspace" | "existing-environment";
	setDuplicateMode: (mode: "new-workspace" | "existing-environment") => void;
	duplicateName: string;
	setDuplicateName: (value: string) => void;
	duplicateDescription: string;
	setDuplicateDescription: (value: string) => void;
	duplicateTargetProject: string;
	setDuplicateTargetProject: (value: string) => void;
	duplicateTargetEnvironment: string;
	setDuplicateTargetEnvironment: (value: string) => void;
	duplicateProjectEnvironments: Environment[] | undefined;
	resetDuplicateDialog: () => void;
	runBulkDuplicate: () => void;
	isDuplicatePending: boolean;
}) => {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Duplicate Services</Dialog.Title>
					<Dialog.Description>
						Duplicate {selectedBulkServices.length} selected service
						{selectedBulkServices.length === 1 ? "" : "s"}.
					</Dialog.Description>
				</div>

				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant={
								duplicateMode === "new-workspace" ? "primary" : "outline"
							}
							onClick={() => {
								setDuplicateMode("new-workspace");
								setDuplicateTargetProject("");
								setDuplicateTargetEnvironment("");
							}}
						>
							New workspace
						</Button>
						<Button
							variant={
								duplicateMode === "existing-environment" ? "primary" : "outline"
							}
							onClick={() => setDuplicateMode("existing-environment")}
						>
							Environment
						</Button>
					</div>

					{duplicateMode === "new-workspace" ? (
						<div className="space-y-3">
							<div className="space-y-2">
								<label
									className="text-sm font-medium"
									htmlFor="duplicate-workspace-name"
								>
									Workspace name
								</label>
								<Input
									aria-label="Workspace name"
									id="duplicate-workspace-name"
									value={duplicateName}
									onChange={(event) => setDuplicateName(event.target.value)}
									placeholder="New workspace"
								/>
							</div>
							<div className="space-y-2">
								<label
									className="text-sm font-medium"
									htmlFor="duplicate-workspace-description"
								>
									Description
								</label>
								<Input
									aria-label="Workspace description"
									id="duplicate-workspace-description"
									value={duplicateDescription}
									onChange={(event) =>
										setDuplicateDescription(event.target.value)
									}
									placeholder="Optional"
								/>
							</div>
						</div>
					) : (
						<div className="space-y-3">
							<div className="space-y-2">
								<p className="text-sm font-medium">Workspace</p>
								<Select
									aria-label="Target workspace"
									value={duplicateTargetProject}
									onValueChange={(value) => {
										if (value === null) return;
										setDuplicateTargetProject(value as string);
										setDuplicateTargetEnvironment("");
									}}
								>
									{allWorkspaces?.map((workspace) => (
										<Select.Option
											key={workspace.workspaceId}
											value={workspace.workspaceId}
										>
											{workspace.name}
										</Select.Option>
									))}
								</Select>
							</div>
							<div className="space-y-2">
								<p className="text-sm font-medium">Environment</p>
								<Select
									aria-label="Target environment"
									value={duplicateTargetEnvironment}
									onValueChange={(value) => {
										if (value !== null) {
											setDuplicateTargetEnvironment(value as string);
										}
									}}
								>
									{duplicateProjectEnvironments?.map((environment) => (
										<Select.Option
											key={environment.environmentId}
											value={environment.environmentId}
										>
											{environment.name}
										</Select.Option>
									))}
								</Select>
							</div>
						</div>
					)}

					<div className="rounded-md border bg-kumo-fill/30 p-3 text-sm">
						{selectedBulkServices.map((service) => (
							<div
								key={getWorkspaceServiceKey(service.type, service.id)}
								className="flex items-center justify-between gap-3 py-1"
							>
								<span className="truncate">{service.name}</span>
								<Badge>{serviceTypeLabels[service.type]}</Badge>
							</div>
						))}
					</div>
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={resetDuplicateDialog}>
						Cancel
					</Button>
					<Button
						onClick={() => void runBulkDuplicate()}
						loading={isDuplicatePending}
						disabled={
							selectedBulkServices.length === 0 ||
							(duplicateMode === "new-workspace" && !duplicateName.trim()) ||
							(duplicateMode === "existing-environment" &&
								!duplicateTargetEnvironment)
						}
					>
						Duplicate services
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
