import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Container, Cpu, Server } from "lucide-react";

interface SummaryCardsProps {
	nodeCount: number;
	downNodeCount: number;
	serviceCount: number;
	unscheduledCount: number;
	runningContainerCount: number;
}

export const SummaryCards = ({
	nodeCount,
	downNodeCount,
	serviceCount,
	unscheduledCount,
	runningContainerCount,
}: SummaryCardsProps) => (
	<div className="grid gap-4 md:grid-cols-3">
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 className="text-sm font-medium">Workers</h3>
				<div className="p-2 bg-kumo-success-tint text-kumo-success rounded-md">
					<Server className="h-4 w-4 text-kumo-success" />
				</div>
			</div>
			<div>
				<div className="text-2xl font-bold">{nodeCount}</div>
				{downNodeCount > 0 && (
					<p className="text-xs text-kumo-danger mt-1">
						{downNodeCount} worker(s) down or drained
					</p>
				)}
			</div>
		</LayerCard>

		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 className="text-sm font-medium">Services</h3>
				<div className="p-2 bg-kumo-success-tint text-kumo-success rounded-md">
					<Cpu className="h-4 w-4 text-kumo-success" />
				</div>
			</div>
			<div>
				<div className="text-2xl font-bold">{serviceCount}</div>
				{unscheduledCount > 0 && (
					<p className="text-xs text-kumo-subtle mt-1">
						{unscheduledCount} with no running tasks
					</p>
				)}
			</div>
		</LayerCard>

		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 className="text-sm font-medium">Running Containers</h3>
				<div className="p-2 bg-kumo-success-tint text-kumo-success rounded-md">
					<Container className="h-4 w-4 text-kumo-success" />
				</div>
			</div>
			<div>
				<div className="text-2xl font-bold">{runningContainerCount}</div>
			</div>
		</LayerCard>
	</div>
);
