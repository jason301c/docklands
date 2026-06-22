import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { CodeEditor } from "@/components/shared/code-editor";
import { toast } from "@/components/shared/toast";

interface Props {
	patchId: string;
	entityId: string;
	type: "application" | "compose";
	onSuccess?: () => void;
}

export const EditPatchDialog = ({
	patchId,
	entityId,
	type,
	onSuccess,
}: Props) => {
	const { data: patch, isPending: isPatchLoading } = api.patch.one.useQuery(
		{ patchId },
		{ enabled: !!patchId },
	);
	const [content, setContent] = useState("");

	useEffect(() => {
		if (patch) {
			setContent(patch.content);
		}
	}, [patch]);

	const utils = api.useUtils();
	const updatePatch = api.patch.update.useMutation();

	const handleSave = () => {
		updatePatch
			.mutateAsync({ patchId, content })
			.then(() => {
				toast.success("Patch saved");
				utils.patch.byEntityId.invalidate({ id: entityId, type });
				onSuccess?.();
			})
			.catch((err) => {
				toast.error(err.message);
			});
	};

	return (
		<Dialog.Root>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit patch"
						variant="ghost"
						shape="square"
						title="Edit patch"
					>
						<Pencil className="h-4 w-4" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0">
				<div className="px-6 pt-6 pb-4">
					<Dialog.Title>Edit Patch</Dialog.Title>
					<Dialog.Description>
						{patch ? `Editing: ${patch.filePath}` : "Loading patch..."}
					</Dialog.Description>
				</div>
				{isPatchLoading ? (
					<div className="flex flex-1 items-center justify-center px-6 py-12">
						<Loader2 className="h-6 w-6 animate-spin text-kumo-subtle" />
					</div>
				) : (
					<div className="flex-1 min-h-0 px-6 overflow-hidden flex flex-col">
						<CodeEditor
							value={content}
							onChange={(value) => setContent(value ?? "")}
							className="h-[400px] w-full"
							wrapperClassName="h-[400px]"
							lineWrapping
						/>
					</div>
				)}
				<div className="px-6 ">
					<Dialog.Close render={<Button variant="outline">Cancel</Button>} />
					<Button onClick={handleSave} loading={updatePatch.isPending}>
						{updatePatch.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Save
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
