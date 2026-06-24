"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Package, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { HandleImageRegistry } from "./handle-image-registry";

const logger = createClientLogger("image-registry");

export const ShowImageRegistry = () => {
	const { mutateAsync, isPending: isRemoving } =
		api.registry.remove.useMutation();
	const registriesQuery = api.registry.all.useQuery();
	const { refetch } = registriesQuery;
	const { permissions } = usePermissions();

	return (
		<SectionCard title="Image Registry">
			<QueryState
				query={registriesQuery}
				isEmpty={(data) => data.length === 0}
				empty={
					<EmptyState
						icon={Package}
						title="You don't have any image registries"
						action={
							permissions?.registry.create ? <HandleImageRegistry /> : null
						}
					/>
				}
			>
				{(data) => (
					<div className="flex flex-col gap-4  min-h-[25vh]">
						<div className="flex flex-col gap-4 rounded-lg ">
							{data.map((registry, index) => (
								<div
									key={registry.registryId}
									className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
								>
									<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border  w-full">
										<div className="flex items-center justify-between">
											<div className="flex gap-2 flex-col">
												<span className="text-sm font-medium">
													{index + 1}. {registry.registryName}
												</span>
												{registry.registryUrl && (
													<div className="text-xs text-kumo-subtle">
														{registry.registryUrl}
													</div>
												)}
											</div>
										</div>

										<div className="flex flex-row gap-1">
											<HandleImageRegistry registryId={registry.registryId} />

											{permissions?.registry.delete && (
												<DialogAction
													title="Delete Image Registry"
													description="Are you sure you want to delete this image registry?"
													type="destructive"
													onClick={async () => {
														await mutateAsync({
															registryId: registry.registryId,
														})
															.then(() => {
																toast.success(
																	"Image registry deleted successfully",
																);
																refetch();
															})
															.catch((err) => {
																logger.error(err);
																toast.error("Error deleting image registry");
															});
													}}
												>
													<Button
														aria-label="Delete image registry"
														variant="ghost"
														shape="square"
														className="group hover:bg-kumo-danger/10 "
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

						{permissions?.registry.create && (
							<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
								<HandleImageRegistry />
							</div>
						)}
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
};
