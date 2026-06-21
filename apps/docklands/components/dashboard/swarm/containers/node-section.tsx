import { ChevronDown, ChevronRight, Server } from "lucide-react";
import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Table } from "@cloudflare/kumo/components/table";
import { ContainerRow } from "./container-row";
import type { ContainerStat, NodeGroup } from "./types";

interface NodeSectionProps {
	group: NodeGroup;
	isExpanded: boolean;
	onToggleNode: (nodeName: string) => void;
	findStatsForContainer: (taskName: string) => ContainerStat | undefined;
}

export const NodeSection = ({
	group,
	isExpanded,
	onToggleNode,
	findStatsForContainer,
}: NodeSectionProps) => {
	const runningCount = group.containers.filter((c) =>
		c.CurrentState.startsWith("Running"),
	).length;

	const nodeDown =
		group.nodeStatus &&
		(group.nodeStatus.Status !== "Ready" ||
			group.nodeStatus.Availability !== "Active");

	return (
		<Collapsible.Root
			open={isExpanded}
			onOpenChange={() => onToggleNode(group.nodeName)}
		>
			<LayerCard className="bg-background">
				<Collapsible.Trigger
					render={
						<button
							type="button"
							className="block w-full text-left rounded-t-lg"
						/>
					}
				>
					<div className="cursor-pointer hover:bg-muted/50 transition-colors">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{isExpanded ? (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								)}
								<div className="relative">
									<Server className="h-5 w-5 text-muted-foreground" />
									{nodeDown && (
										<span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
									)}
								</div>
								<h3 className="text-base">{group.nodeName}</h3>
								{group.nodeStatus && (
									<Badge
										variant={
											group.nodeStatus.ManagerStatus === "Leader"
												? "secondary"
												: group.nodeStatus.ManagerStatus === "Reachable"
													? "secondary"
													: "outline"
										}
										className="text-[10px]"
									>
										{group.nodeStatus.ManagerStatus || "Worker"}
									</Badge>
								)}
								<Badge variant="secondary">
									{group.containers.length} container
									{group.containers.length !== 1 ? "s" : ""}
								</Badge>
								{nodeDown ? (
									<Badge variant="error">
										{group.nodeStatus?.Status} /{" "}
										{group.nodeStatus?.Availability}
									</Badge>
								) : runningCount === group.containers.length ? (
									<Badge variant="primary">All Running</Badge>
								) : (
									<Badge variant="orange">
										{runningCount}/{group.containers.length} Running
									</Badge>
								)}
							</div>
						</div>
					</div>
				</Collapsible.Trigger>
				<Collapsible.Panel>
					<div className="pt-0">
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head className="w-[250px]">Container</Table.Head>
									<Table.Head>State</Table.Head>
									<Table.Head className="text-right">CPU</Table.Head>
									<Table.Head className="text-right">Memory</Table.Head>
									<Table.Head className="text-right">Block I/O</Table.Head>
									<Table.Head className="text-right">Network I/O</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{group.containers.map((container) => {
									const stat = findStatsForContainer(container.Name);
									return (
										<ContainerRow
											key={container.ID}
											container={container}
											stat={stat}
										/>
									);
								})}
							</Table.Body>
						</Table>
					</div>
				</Collapsible.Panel>
			</LayerCard>
		</Collapsible.Root>
	);
};
