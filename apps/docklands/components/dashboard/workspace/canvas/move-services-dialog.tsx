"use client";

import { Button } from "@cloudflare/kumo/components/button";
import type { RouterOutputs } from "@/client/api/trpc";
import { Dialog } from "@/components/shared/dialog";
import { Select } from "@/components/shared/select";
import type { WorkspaceService } from "@/shared/workspace-graph";

type Workspace = RouterOutputs["workspaces"]["all"][number];
type Environment = RouterOutputs["environment"]["byWorkspaceId"][number];

export const MoveServicesDialog = ({
	open,
	onOpenChange,
	selectedBulkServices,
	allWorkspaces,
	selectedTargetProject,
	setSelectedTargetProject,
	selectedTargetEnvironment,
	setSelectedTargetEnvironment,
	targetEnvironments,
	resetMoveDialog,
	runBulkMove,
	isBulkActionLoading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedBulkServices: WorkspaceService[];
	allWorkspaces: Workspace[] | undefined;
	selectedTargetProject: string;
	setSelectedTargetProject: (value: string) => void;
	selectedTargetEnvironment: string;
	setSelectedTargetEnvironment: (value: string) => void;
	targetEnvironments: Environment[];
	resetMoveDialog: () => void;
	runBulkMove: () => void;
	isBulkActionLoading: boolean;
}) => {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog className="sm:max-w-lg">
				<Dialog.Header>
					<Dialog.Title>Move Services</Dialog.Title>
					<Dialog.Description>
						Move {selectedBulkServices.length} selected service
						{selectedBulkServices.length === 1 ? "" : "s"} to another
						environment.
					</Dialog.Description>
				</Dialog.Header>

				<div className="space-y-4">
					<div className="space-y-2">
						<p className="text-sm font-medium">Workspace</p>
						<Select
							aria-label="Target workspace"
							value={selectedTargetProject}
							onValueChange={(value) => {
								if (value === null) return;
								setSelectedTargetProject(value as string);
								setSelectedTargetEnvironment("");
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
							value={selectedTargetEnvironment}
							onValueChange={(value) => {
								if (value !== null) {
									setSelectedTargetEnvironment(value as string);
								}
							}}
						>
							{targetEnvironments.map((environment) => (
								<Select.Option
									key={environment.environmentId}
									value={environment.environmentId}
								>
									{environment.name}
								</Select.Option>
							))}
						</Select>
						{selectedTargetProject && targetEnvironments.length === 0 && (
							<p className="text-xs text-kumo-subtle">
								This workspace has no other environments.
							</p>
						)}
					</div>
				</div>

				<Dialog.Footer>
					<Button variant="outline" onClick={resetMoveDialog}>
						Cancel
					</Button>
					<Button
						onClick={() => void runBulkMove()}
						loading={isBulkActionLoading}
						disabled={
							selectedBulkServices.length === 0 ||
							!selectedTargetProject ||
							!selectedTargetEnvironment
						}
					>
						Move services
					</Button>
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
