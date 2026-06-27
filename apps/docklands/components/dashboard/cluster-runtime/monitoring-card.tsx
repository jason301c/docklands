import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { Activity, Server, Settings, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/client/api/trpc";
import { SectionCard } from "@/components/shared/section-card";
import { QueryState } from "@/components/shared/states";
import { NodeCard } from "./details/details-card";

interface Props {
	runtimeWorkerId?: string;
}

interface StatCardProps {
	label: string;
	value: string;
	icon: typeof Server;
	hint?: string;
	tooltip?: React.ReactNode;
}

function StatCard({ label, value, icon: Icon, hint, tooltip }: StatCardProps) {
	const body = (
		<LayerCard className="bg-kumo-base">
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-medium text-kumo-subtle">{label}</span>
				<Icon className="size-4 text-kumo-subtle" />
			</div>
			<div className="mt-2 flex items-baseline gap-2">
				<span className="font-display font-semibold text-2xl tracking-tight">
					{value}
				</span>
				{hint ? <span className="text-xs text-kumo-subtle">{hint}</span> : null}
			</div>
		</LayerCard>
	);

	if (!tooltip) return body;

	return (
		<TooltipProvider>
			<Tooltip content={tooltip}>{body}</Tooltip>
		</TooltipProvider>
	);
}

export default function ClusterMonitorCard({ runtimeWorkerId }: Props) {
	const router = useRouter();
	const nodesQuery = api.swarm.getNodes.useQuery({ runtimeWorkerId });

	return (
		<SectionCard
			title="Cluster Runtime"
			actions={
				!runtimeWorkerId ? (
					<Button
						variant="secondary"
						onClick={() => router.push("/dashboard/settings/cluster-nodes")}
					>
						<Settings className="mr-2 size-4" />
						Manage Cluster Nodes
					</Button>
				) : undefined
			}
		>
			<QueryState
				query={nodesQuery}
				loadingLabel="Loading cluster…"
				errorTitle="Could not load cluster nodes"
			>
				{(nodes) => {
					const totalNodes = nodes.length;
					const activeNodes = nodes.filter((node) => node.Status === "Ready");
					const managerNodes = nodes.filter(
						(node) =>
							node.ManagerStatus === "Leader" ||
							node.ManagerStatus === "Reachable",
					);
					const hostnameList = (list: typeof nodes) =>
						list.length ? (
							<div className="max-h-48 space-y-1 overflow-y-auto text-xs">
								{list.map((node) => (
									<div key={node.ID}>{node.Hostname}</div>
								))}
							</div>
						) : undefined;

					return (
						<div className="flex flex-col gap-6">
							<p className="text-sm text-kumo-subtle">
								Runtime workers and node health across the cluster.
							</p>

							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<StatCard
									label="Total Workers"
									value={String(totalNodes)}
									icon={Server}
								/>
								<StatCard
									label="Active Workers"
									value={`${activeNodes.length} / ${totalNodes}`}
									icon={Activity}
									tooltip={hostnameList(activeNodes)}
								/>
								<StatCard
									label="Managers"
									value={`${managerNodes.length} / ${totalNodes}`}
									icon={ShieldCheck}
									tooltip={hostnameList(managerNodes)}
								/>
							</div>

							<div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
								{nodes.map((node) => (
									<NodeCard
										key={node.ID}
										node={node}
										runtimeWorkerId={runtimeWorkerId}
									/>
								))}
							</div>

							{totalNodes === 0 ? (
								<Badge variant="secondary">No nodes reporting</Badge>
							) : null}
						</div>
					);
				}}
			</QueryState>
		</SectionCard>
	);
}
