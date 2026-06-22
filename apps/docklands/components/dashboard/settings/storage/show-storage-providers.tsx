import { Button } from "@cloudflare/kumo/components/button";
import { Database, FolderUp, Loader2, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { HandleStorageProvider } from "./handle-storage-provider";

export const ShowStorageProviders = () => {
	const { data, isPending, refetch } = api.destination.all.useQuery();
	const { mutateAsync, isPending: isRemoving } =
		api.destination.remove.useMutation();
	const { data: permissions } = api.user.getPermissions.useQuery();
	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<Database className="size-6 text-kumo-subtle self-center" />
						Storage providers
					</h3>
					<p>
						Add your providers like AWS S3, Cloudflare R2, Wasabi, DigitalOcean
						Spaces etc.
					</p>
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
									<FolderUp className="size-8 self-center text-kumo-subtle" />
									<span className="text-base text-kumo-subtle">
										To create a backup it is required to set at least 1
										provider.
									</span>
									{permissions?.destination.create && <HandleStorageProvider />}
								</div>
							) : (
								<div className="flex flex-col gap-4  min-h-[25vh]">
									<div className="flex flex-col gap-4 rounded-lg ">
										{data?.map((destination, index) => (
											<div
												key={destination.destinationId}
												className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
											>
												<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border  w-full">
													<div className="flex flex-col gap-1">
														<span className="text-sm">
															{index + 1}. {destination.name}
														</span>
														<span className="text-xs text-kumo-subtle">
															Created at:{" "}
															{new Date(
																destination.createdAt,
															).toLocaleDateString()}
														</span>
													</div>
													<div className="flex flex-row gap-1">
														<HandleStorageProvider
															destinationId={destination.destinationId}
														/>
														{permissions?.destination.delete && (
															<DialogAction
																title="Delete Storage Provider"
																description="Are you sure you want to delete this storage provider?"
																type="destructive"
																onClick={async () => {
																	await mutateAsync({
																		destinationId: destination.destinationId,
																	})
																		.then(() => {
																			toast.success(
																				"Storage provider deleted successfully",
																			);
																			refetch();
																		})
																		.catch(() => {
																			toast.error(
																				"Error deleting storage provider",
																			);
																		});
																}}
															>
																<Button
																	aria-label="Delete storage provider"
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

									{permissions?.destination.create && (
										<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
											<HandleStorageProvider />
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
