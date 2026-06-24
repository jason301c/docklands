"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Database, FolderUp, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { HandleStorageProvider } from "./handle-storage-provider";

const logger = createClientLogger("storage-providers");

export const ShowStorageProviders = () => {
	const destinationsQuery = api.destination.all.useQuery();
	const { refetch } = destinationsQuery;
	const { mutateAsync, isPending: isRemoving } =
		api.destination.remove.useMutation();
	const { permissions } = usePermissions();
	return (
		<SectionCard
			icon={Database}
			title="Storage providers"
			description="Add your providers like AWS S3, Cloudflare R2, Wasabi, DigitalOcean Spaces etc."
		>
			<QueryState
				query={destinationsQuery}
				isEmpty={(data) => data.length === 0}
				empty={
					<EmptyState
						icon={FolderUp}
						title="To create a backup it is required to set at least 1 provider."
						action={
							permissions?.destination.create ? <HandleStorageProvider /> : null
						}
					/>
				}
			>
				{(data) => (
					<div className="flex flex-col gap-4  min-h-[25vh]">
						<div className="flex flex-col gap-4 rounded-lg ">
							{data.map((destination, index) => (
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
												{new Date(destination.createdAt).toLocaleDateString()}
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
															.catch((err) => {
																logger.error(err);
																toast.error("Error deleting storage provider");
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
			</QueryState>
		</SectionCard>
	);
};
