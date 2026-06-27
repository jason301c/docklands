import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Box, Cpu, HardDrive, Loader2, MemoryStick } from "lucide-react";
import { api } from "@/client/api/trpc";
import { Separator } from "@/components/shared/separator";
import { cn } from "@/shared/utils";
import { ShowNodeApplications } from "../applications/show-applications";
import { ShowNodeConfig } from "./show-node-config";

export interface ClusterNodeSummary {
	ID: string;
	Hostname: string;
	Availability: string;
	EngineVersion: string;
	Status: string;
	ManagerStatus: string;
	TLSStatus: string;
}

interface Props {
	node: ClusterNodeSummary;
	runtimeWorkerId?: string;
}

interface StatProps {
	label: string;
	value: string;
	icon: typeof Cpu;
}

function Stat({ label, value, icon: Icon }: StatProps) {
	return (
		<div className="space-y-1">
			<div className="flex items-center gap-1.5 text-xs text-kumo-subtle">
				<Icon className="size-3.5" />
				{label}
			</div>
			<div className="font-medium text-sm">{value}</div>
		</div>
	);
}

export function NodeCard({ node, runtimeWorkerId }: Props) {
	const { data, isPending } = api.swarm.getNodeInfo.useQuery({
		nodeId: node.ID,
		runtimeWorkerId,
	});

	const isReady = node.Status === "Ready";
	const cpuCores = data?.Description?.Resources?.NanoCPUs
		? `${(data.Description.Resources.NanoCPUs / 1e9).toFixed(2)} Core(s)`
		: "—";
	const memory = data?.Description?.Resources?.MemoryBytes
		? `${(data.Description.Resources.MemoryBytes / 1024 ** 3).toFixed(2)} GB`
		: "—";

	return (
		<LayerCard className="w-full bg-kumo-elevated p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2.5">
					<span
						className={cn(
							"size-2.5 rounded-full",
							isReady ? "bg-kumo-success" : "bg-kumo-danger",
						)}
					/>
					<span className="font-medium">{node.Hostname}</span>
					<Badge variant="secondary">{node.ManagerStatus || "Worker"}</Badge>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant={isReady ? "success" : "secondary"}>
						{node.Status}
					</Badge>
					<Badge variant="outline">TLS {node.TLSStatus}</Badge>
					<Badge variant="outline">{node.Availability}</Badge>
				</div>
			</div>

			<Separator className="my-4" />

			{isPending ? (
				<div className="flex items-center justify-center py-4">
					<Loader2 className="size-5 animate-spin text-kumo-subtle" />
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<Stat
							label="Engine Version"
							value={node.EngineVersion}
							icon={HardDrive}
						/>
						<Stat label="CPU" value={cpuCores} icon={Cpu} />
						<Stat label="Memory" value={memory} icon={MemoryStick} />
						<Stat
							label="IP Address"
							value={data?.Status?.Addr ?? "—"}
							icon={Box}
						/>
					</div>

					<div className="mt-4 flex justify-end gap-2">
						<ShowNodeConfig
							nodeId={node.ID}
							runtimeWorkerId={runtimeWorkerId}
						/>
						<ShowNodeApplications runtimeWorkerId={runtimeWorkerId} />
					</div>
				</>
			)}
		</LayerCard>
	);
}
