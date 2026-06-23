import { Button } from "@cloudflare/kumo/components/button";
import { Loader2, TagIcon, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { TagBadge } from "@/components/shared/tag-badge";
import { toast } from "@/components/shared/toast";
import { HandleTag } from "./handle-tag";

const logger = createClientLogger("tags");

export const TagManager = () => {
	const utils = api.useUtils();
	const { data: tags, isPending } = api.tag.all.useQuery();
	const { mutateAsync: deleteTag, isPending: isRemoving } =
		api.tag.remove.useMutation();
	const { permissions } = usePermissions();

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div>
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<TagIcon className="size-6 text-kumo-subtle self-center" />
						Tags
					</h3>
					<p>Create and manage tags to organize your workspaces</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					{isPending ? (
						<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[25vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						<>
							{!tags || tags.length === 0 ? (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<TagIcon className="size-6 text-kumo-subtle" />
									<span className="text-base text-kumo-subtle text-center">
										No tags yet. Create your first tag to start organizing
										workspaces.
									</span>
									{permissions?.tag.create && <HandleTag />}
								</div>
							) : (
								<div className="flex flex-col gap-4 min-h-[25vh]">
									<div className="flex flex-col gap-4 rounded-lg">
										{tags.map((tag) => (
											<div
												key={tag.tagId}
												className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
											>
												<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border w-full">
													<div className="flex items-center gap-3">
														<TagBadge name={tag.name} color={tag.color} />
														{tag.color && (
															<span className="text-xs text-kumo-subtle font-mono">
																{tag.color}
															</span>
														)}
													</div>
													<div className="flex flex-row gap-1 items-center">
														{permissions?.tag.update && (
															<HandleTag tagId={tag.tagId} />
														)}
														{permissions?.tag.delete && (
															<DialogAction
																title="Delete Tag"
																description={`Are you sure you want to delete the tag "${tag.name}"? This will remove the tag from all workspaces. This action cannot be undone.`}
																type="destructive"
																onClick={async () => {
																	await deleteTag({
																		tagId: tag.tagId,
																	})
																		.then(async () => {
																			await utils.tag.all.invalidate();
																			toast.success("Tag deleted successfully");
																		})
																		.catch((err) => {
																			logger.error(err);
																			toast.error("Error deleting tag");
																		});
																}}
															>
																<Button
																	aria-label="Delete tag"
																	variant="ghost"
																	shape="square"
																	className="group hover:bg-kumo-danger/10"
																	loading={isRemoving}
																>
																	<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
																</Button>
															</DialogAction>
														)}
													</div>
												</div>
											</div>
										))}
									</div>

									{permissions?.tag.create && (
										<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
											<HandleTag />
										</div>
									)}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};
