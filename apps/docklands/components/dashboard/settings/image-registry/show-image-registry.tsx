"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Loader2, Package, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { HandleImageRegistry } from "./handle-image-registry";

const logger = createClientLogger("image-registry");

export const ShowImageRegistry = () => {
	const { mutateAsync, isPending: isRemoving } =
		api.registry.remove.useMutation();
	const { data, isPending, refetch } = api.registry.all.useQuery();
	const { permissions } = usePermissions();

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<Package className="size-6 text-kumo-subtle self-center" />
						Image Registry
					</h3>
					<p>Manage credentials for container image registries.</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					{isPending ? (
						<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[25vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						<>
							{data?.length === 0 ? (
								<div className="flex flex-col items-center gap-3  min-h-[25vh] justify-center">
									<Package className="size-8 self-center text-kumo-subtle" />
									<span className="text-base text-kumo-subtle text-center">
										You don't have any image registries
									</span>
									{permissions?.registry.create && <HandleImageRegistry />}
								</div>
							) : (
								<div className="flex flex-col gap-4  min-h-[25vh]">
									<div className="flex flex-col gap-4 rounded-lg ">
										{data?.map((registry, index) => (
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
														<HandleImageRegistry
															registryId={registry.registryId}
														/>

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
																			toast.error(
																				"Error deleting image registry",
																			);
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
						</>
					)}
				</div>
			</div>
		</div>
	);
};
