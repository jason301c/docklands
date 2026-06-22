import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	Activity,
	Loader2,
	Monitor,
	Server,
	Settings,
	WorkflowIcon,
} from "lucide-react";
import { api } from "@/client/api/trpc";
import { NodeCard } from "./details/details-card";

interface Props {
	runtimeWorkerId?: string;
}

export default function ClusterMonitorCard({ runtimeWorkerId }: Props) {
	const { data: nodes, isPending } = api.swarm.getNodes.useQuery({
		runtimeWorkerId,
	});

	if (isPending) {
		return (
			<div className="mx-auto flex w-full flex-col gap-4 rounded-lg border bg-background p-6">
				<div className="flex min-h-[55vh] items-center justify-center text-muted-foreground">
					<span className="flex flex-row items-center justify-center gap-2 text-sm">
						Loading...
						<Loader2 className="size-4 animate-spin" />
					</span>
				</div>
			</div>
		);
	}

	if (!nodes) {
		return (
			<div className="mx-auto flex w-full flex-col gap-4 rounded-lg border bg-background p-6">
				<div className="flex min-h-[55vh] items-center justify-center text-destructive">
					<span>Failed to load data</span>
				</div>
			</div>
		);
	}

	const totalNodes = nodes.length;
	const activeNodesCount = nodes.filter(
		(node) => node.Status === "Ready",
	).length;
	const managerNodesCount = nodes.filter(
		(node) =>
			node.ManagerStatus === "Leader" || node.ManagerStatus === "Reachable",
	).length;
	const activeNodes = nodes.filter((node) => node.Status === "Ready");
	const managerNodes = nodes.filter(
		(node) =>
			node.ManagerStatus === "Leader" || node.ManagerStatus === "Reachable",
	);

	return (
		<div className="mx-auto flex w-full flex-col gap-4 rounded-lg border bg-background p-6">
			<header className="flex items-center flex-wrap gap-4 justify-between">
				<div className="space-y-1">
					<h3 className="text-xl flex flex-row gap-2">
						<WorkflowIcon className="size-6 text-muted-foreground self-center" />
						Cluster Runtime Overview
					</h3>
					<p className="text-sm text-muted-foreground">
						Monitor runtime workers and node health across the cluster.
					</p>
				</div>
				{!runtimeWorkerId && (
					<Button
						onClick={() =>
							window.location.replace("/dashboard/settings/cluster-nodes")
						}
					>
						<Settings className="mr-2 h-4 w-4" />
						Manage Cluster Nodes
					</Button>
				)}
			</header>

			<div className="grid gap-6 lg:grid-cols-3">
				<LayerCard className="bg-background">
					<div className="flex flex-row items-center justify-between space-y-0 pb-2">
						<h3 className="text-sm font-medium">Total Workers</h3>
						<div className="p-2 bg-emerald-600/20 text-emerald-600 rounded-md">
							<Server className="h-4 w-4 text-muted-foreground dark:text-emerald-600" />
						</div>
					</div>
					<div>
						<div className="text-2xl font-bold">{totalNodes}</div>
					</div>
				</LayerCard>

				<LayerCard className="bg-background">
					<div className="flex flex-row items-center justify-between space-y-0 pb-2">
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-medium">Active Workers</h3>
							<Badge variant="green">Online</Badge>
						</div>
						<div className="p-2 bg-emerald-600/20 text-emerald-600 rounded-md">
							<Activity className="h-4 w-4 text-muted-foreground dark:text-emerald-600" />
						</div>
					</div>
					<div>
						<TooltipProvider>
							<Tooltip
								content={
									<>
										<div className="max-h-48 overflow-y-auto">
											{activeNodes.map((node) => (
												<div key={node.ID} className="flex items-center gap-2">
													{node.Hostname}
												</div>
											))}
										</div>
									</>
								}
							>
								<div className="text-2xl font-bold">
									{activeNodesCount} / {totalNodes}
								</div>
							</Tooltip>
						</TooltipProvider>
					</div>
				</LayerCard>

				<LayerCard className="bg-background">
					<div className="flex flex-row items-center justify-between space-y-0 pb-2">
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-medium">Managers</h3>
							<Badge variant="green">Online</Badge>
						</div>
						<div className="p-2 bg-emerald-600/20 text-emerald-600 rounded-md">
							<Monitor className="h-4 w-4 text-muted-foreground dark:text-emerald-600" />
						</div>
					</div>
					<div>
						<TooltipProvider>
							<Tooltip
								content={
									<>
										<div className="max-h-48 overflow-y-auto">
											{managerNodes.map((node) => (
												<div key={node.ID} className="flex items-center gap-2">
													{node.Hostname}
												</div>
											))}
										</div>
									</>
								}
							>
								<div className="text-2xl font-bold">
									{managerNodesCount} / {totalNodes}
								</div>
							</Tooltip>
						</TooltipProvider>
					</div>
				</LayerCard>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
				{nodes.map((node) => (
					<NodeCard
						key={node.ID}
						node={node}
						runtimeWorkerId={runtimeWorkerId}
					/>
				))}
			</div>
		</div>
	);
}
