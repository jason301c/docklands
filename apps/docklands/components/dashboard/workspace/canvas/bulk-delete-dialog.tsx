"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import {
	getWorkspaceServiceKey,
	type WorkspaceService,
} from "@/shared/workspace-graph";
import { serviceTypeLabels } from "./constants";

export const BulkDeleteDialog = ({
	open,
	onOpenChange,
	selectedBulkServices,
	selectedBulkRunningServices,
	deleteComposeVolumes,
	setDeleteComposeVolumes,
	resetBulkDeleteDialog,
	runBulkDelete,
	isBulkActionLoading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedBulkServices: WorkspaceService[];
	selectedBulkRunningServices: WorkspaceService[];
	deleteComposeVolumes: boolean;
	setDeleteComposeVolumes: (value: boolean) => void;
	resetBulkDeleteDialog: () => void;
	runBulkDelete: () => void;
	isBulkActionLoading: boolean;
}) => {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Delete Services</Dialog.Title>
					<Dialog.Description>
						Delete {selectedBulkServices.length} selected service
						{selectedBulkServices.length === 1 ? "" : "s"}. This cannot be
						undone.
					</Dialog.Description>
				</div>

				<div className="space-y-4 text-sm">
					{selectedBulkRunningServices.length > 0 ? (
						<div className="rounded-md border border-kumo-danger/30 bg-kumo-danger/10 p-3 text-kumo-danger">
							Stop {selectedBulkRunningServices.length} running service
							{selectedBulkRunningServices.length === 1 ? "" : "s"} before
							deleting.
						</div>
					) : (
						<div className="rounded-md border bg-kumo-fill/30 p-3">
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
					)}

					{selectedBulkServices.some(
						(service) => service.type === "compose",
					) && (
						<div className="flex items-center gap-2">
							<Checkbox
								aria-label="Delete compose volumes too"
								checked={deleteComposeVolumes}
								onCheckedChange={(checked) =>
									setDeleteComposeVolumes(checked === true)
								}
							/>
							<span>Delete compose volumes too</span>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={resetBulkDeleteDialog}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={() => void runBulkDelete()}
						loading={isBulkActionLoading}
						disabled={
							selectedBulkServices.length === 0 ||
							selectedBulkRunningServices.length > 0
						}
					>
						Delete services
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
