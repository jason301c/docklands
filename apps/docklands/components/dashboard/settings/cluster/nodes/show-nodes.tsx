import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	Boxes,
	HelpCircle,
	Loader2,
	LockIcon,
	MoreHorizontal,
} from "lucide-react";
import { api } from "@/client/api/trpc";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { AddNode } from "./add-node";
import { ShowNodeData } from "./show-node-data";

interface Props {
	serverId?: string;
}

export const ShowNodes = ({ serverId }: Props) => {
	const { data, isPending, refetch } = api.cluster.getNodes.useQuery({
		serverId,
	});
	const { data: registry } = api.registry.all.useQuery();

	const { mutateAsync: deleteNode } = api.cluster.removeWorker.useMutation();

	const haveAtLeastOneRegistry = !!(registry && registry?.length > 0);
	return (
		<div className="w-full">
			<LayerCard className="h-full bg-sidebar  p-2.5 rounded-xl  max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md ">
					<div className="flex flex-row gap-2 justify-between w-full items-center flex-wrap">
						<div className="flex flex-col gap-2">
							<h3 className="text-xl flex flex-row gap-2">
								<Boxes className="size-6 text-muted-foreground self-center" />
								Cluster
							</h3>
							<p>Add nodes to your cluster</p>
						</div>
						{haveAtLeastOneRegistry && (
							<div className="flex flex-row gap-2">
								<AddNode serverId={serverId} />
							</div>
						)}
					</div>
					<div className="space-y-2 py-8 border-t min-h-[35vh]">
						{isPending ? (
							<div className="flex items-center justify-center w-full h-[40vh]">
								<Loader2 className="size-8 animate-spin text-muted-foreground" />
							</div>
						) : haveAtLeastOneRegistry ? (
							<div className="grid md:grid-cols-1 gap-4">
								<Table>
									<caption>A list of your managers / workers.</caption>
									<Table.Header>
										<Table.Row>
											<Table.Head className="text-left">Hostname</Table.Head>
											<Table.Head className="text-right">Status</Table.Head>
											<Table.Head className="text-right">Role</Table.Head>
											<Table.Head className="text-right">
												Availability
											</Table.Head>
											<Table.Head className="text-right">
												Engine Version
											</Table.Head>
											<Table.Head className="text-right">Created</Table.Head>

											<Table.Head className="text-right">Actions</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{data?.map((node) => {
											const isManager = node.Spec.Role === "manager";
											return (
												<Table.Row key={node.ID}>
													<Table.Cell className="text-left">
														{node.Description.Hostname}
													</Table.Cell>
													<Table.Cell className="text-right">
														{node.Status.State}
													</Table.Cell>
													<Table.Cell className="text-right">
														<Badge
															variant={isManager ? "secondary" : "secondary"}
														>
															{node?.Spec?.Role}
														</Badge>
													</Table.Cell>
													<Table.Cell className="text-right">
														{node.Spec.Availability}
													</Table.Cell>

													<Table.Cell className="text-right">
														{node?.Description.Engine.EngineVersion}
													</Table.Cell>

													<Table.Cell className="text-right">
														<DateTooltip
															date={node.CreatedAt}
															className="text-sm"
														>
															Created{" "}
														</DateTooltip>
													</Table.Cell>
													<Table.Cell className="text-right flex justify-end">
														<DropdownMenu>
															<DropdownMenu.Trigger
																render={
																	<Button
																		aria-label={`Open actions for ${node.Description.Hostname}`}
																		variant="ghost"
																		className="h-8 w-8 p-0"
																	>
																		<span className="sr-only">
																			Open actions for{" "}
																			{node.Description.Hostname}
																		</span>
																		<MoreHorizontal className="h-4 w-4" />
																	</Button>
																}
															/>
															<DropdownMenu.Content align="end">
																<DropdownMenu.Label>Actions</DropdownMenu.Label>
																<ShowNodeData data={node} />
																{!node?.ManagerStatus?.Leader && (
																	<DialogAction
																		title="Delete Node"
																		description="Are you sure you want to delete this node from the cluster?"
																		type="destructive"
																		onClick={async () => {
																			await deleteNode({
																				nodeId: node.ID,
																				serverId,
																			})
																				.then(() => {
																					refetch();
																					toast.success(
																						"Node deleted successfully",
																					);
																				})
																				.catch(() => {
																					toast.error("Error deleting node");
																				});
																		}}
																	>
																		<DropdownMenu.Item
																			onSelect={(e) => e.preventDefault()}
																		>
																			Delete
																		</DropdownMenu.Item>
																	</DialogAction>
																)}
															</DropdownMenu.Content>
														</DropdownMenu>
													</Table.Cell>
												</Table.Row>
											);
										})}
									</Table.Body>
								</Table>
							</div>
						) : (
							<div className="flex flex-col items-center gap-3">
								<LockIcon className="size-8 text-muted-foreground" />
								<div className="flex flex-row gap-2">
									<span className="text-base text-muted-foreground ">
										To add nodes to your cluster, you need to configure at least
										one registry.
									</span>
									<TooltipProvider delay={0}>
										<Tooltip
											content={<>Nodes need a registry to pull images from.</>}
										>
											<HelpCircle className="size-5 text-muted-foreground " />
										</Tooltip>
									</TooltipProvider>
								</div>

								<ul className="list-disc list-inside text-sm text-muted-foreground border p-4 rounded-lg flex flex-col gap-1.5 mt-2.5">
									<li>
										<strong>Image Registry:</strong> Use custom registries like
										Docker Hub, DigitalOcean Registry, etc.
									</li>
								</ul>
							</div>
						)}
					</div>
				</div>
			</LayerCard>
		</div>
	);
};
