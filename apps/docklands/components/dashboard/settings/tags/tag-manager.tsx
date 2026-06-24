"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { TagIcon, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { HandleTag } from "@/components/dashboard/shared/handle-tag";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, QueryState } from "@/components/shared/states";
import { TagBadge } from "@/components/shared/tag-badge";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("tags");

export const TagManager = () => {
	const utils = api.useUtils();
	const tagsQuery = api.tag.all.useQuery();
	const { mutateAsync: deleteTag, isPending: isRemoving } =
		api.tag.remove.useMutation();
	const { permissions } = usePermissions();

	return (
		<SectionCard title="Tags">
			<QueryState
				query={tagsQuery}
				isEmpty={(tags) => tags.length === 0}
				empty={
					<EmptyState
						icon={TagIcon}
						title="No tags yet. Create your first tag to start organizing workspaces."
						action={permissions?.tag.create ? <HandleTag /> : null}
					/>
				}
			>
				{(tags) => (
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
			</QueryState>
		</SectionCard>
	);
};
