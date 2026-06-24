import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Table } from "@cloudflare/kumo/components/table";
import { File, FilePlus2, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { EditPatchDialog } from "./edit-patch-dialog";
import { PatchEditor } from "./patch-editor";

const logger = createClientLogger("patches");

interface Props {
	id: string;
	type: "application" | "compose";
}

export const ShowPatches = ({ id, type }: Props) => {
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [repoPath, setRepoPath] = useState<string | null>(null);
	const [isLoadingRepo, setIsLoadingRepo] = useState(false);

	const utils = api.useUtils();

	const patchesQuery = api.patch.byEntityId.useQuery(
		{ id, type },
		{ enabled: !!id },
	);
	const { data: patches } = patchesQuery;

	const ensureRepo = api.patch.ensureRepo.useMutation();

	const togglePatch = api.patch.toggleEnabled.useMutation();

	const { mutateAsync } = api.patch.delete.useMutation();

	const handleCloseEditor = () => {
		setSelectedFile(null);
		setRepoPath(null);
	};

	if (repoPath) {
		return (
			<PatchEditor
				id={id}
				type={type}
				repoPath={repoPath || ""}
				onClose={handleCloseEditor}
			/>
		);
	}

	const handleOpenEditor = async () => {
		setIsLoadingRepo(true);
		await ensureRepo
			.mutateAsync({ id, type })
			.then((result) => {
				setRepoPath(result);
			})
			.catch((err) => {
				logger.error("Failed to prepare patch repository", err);
				toast.error(err.message);
			})
			.finally(() => {
				setIsLoadingRepo(false);
			});
	};

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row items-center justify-between">
				<div>
					<h3>Patches</h3>
					<p>
						Apply code patches to your repository during build. Patches are
						applied after cloning the repository and before building.
					</p>
				</div>
				{patches && patches?.length > 0 && (
					<Button onClick={handleOpenEditor} disabled={isLoadingRepo}>
						{isLoadingRepo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						<FilePlus2 className="mr-2 h-4 w-4" />
						Create Patch
					</Button>
				)}
			</div>
			<div>
				<QueryState
					query={patchesQuery}
					isEmpty={(patches) => patches.length === 0}
					empty={
						<div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8">
							<div className="rounded-full bg-kumo-fill p-4">
								<FilePlus2 className="h-10 w-10 text-kumo-subtle" />
							</div>
							<div className="space-y-1 text-center">
								<p className="text-sm font-medium">No patches yet</p>
								<p className="max-w-sm text-sm text-kumo-subtle">
									Add file patches to modify your repo before each
									build—configs, env, or code. Create your first patch to get
									started.
								</p>
							</div>
							<Button onClick={handleOpenEditor} disabled={isLoadingRepo}>
								{isLoadingRepo && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								<FilePlus2 className="mr-2 h-4 w-4" />
								Create Patch
							</Button>
						</div>
					}
					errorTitle="Failed to load patches"
				>
					{(patches) => (
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>File Path</Table.Head>
									<Table.Head className="w-[80px]">Type</Table.Head>
									<Table.Head className="w-[100px]">Enabled</Table.Head>
									<Table.Head className="w-[100px]">Actions</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{patches.map((patch) => (
									<Table.Row key={patch.patchId}>
										<Table.Cell className="font-mono text-sm">
											<div className="flex items-center gap-2">
												<File className="h-4 w-4 text-kumo-subtle shrink-0" />
												{patch.filePath}
											</div>
										</Table.Cell>
										<Table.Cell>
											<Badge
												variant={
													patch.type === "delete"
														? "destructive"
														: patch.type === "create"
															? "secondary"
															: "secondary"
												}
												className="font-normal"
											>
												{patch.type}
											</Badge>
										</Table.Cell>
										<Table.Cell>
											<Switch
												checked={patch.enabled}
												onCheckedChange={(checked) => {
													togglePatch
														.mutateAsync({
															patchId: patch.patchId,
															enabled: checked,
														})
														.then(() => {
															toast.success("Patch updated");
															utils.patch.byEntityId.invalidate({
																id,
																type,
															});
														})
														.catch((err) => {
															logger.error("Failed to toggle patch", err);
															toast.error(err.message);
														})
														.finally(() => {
															setIsLoadingRepo(false);
														});
												}}
											/>
										</Table.Cell>
										<Table.Cell>
											<div className="flex items-center gap-1">
												{(patch.type === "update" ||
													patch.type === "create") && (
													<EditPatchDialog
														patchId={patch.patchId}
														entityId={id}
														type={type}
													/>
												)}
												<Button
													aria-label="Delete patch"
													variant="ghost"
													shape="square"
													onClick={() => {
														mutateAsync({ patchId: patch.patchId })
															.then(() => {
																toast.success("Patch deleted");
																utils.patch.byEntityId.invalidate({
																	id,
																	type,
																});
															})
															.catch((err) => {
																logger.error("Failed to delete patch", err);
																toast.error(err.message);
															});
													}}
													title="Delete patch"
												>
													<Trash2 className="h-4 w-4 text-kumo-danger" />
												</Button>
											</div>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					)}
				</QueryState>
			</div>
		</LayerCard>
	);
};
