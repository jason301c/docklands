import { Badge } from "@cloudflare/kumo/components/badge";
import { Table } from "@cloudflare/kumo/components/table";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { AlertCircle, HardDrive, Network } from "lucide-react";
import type { ContainerInfo, ContainerStat } from "./types";
import { formatCpu, formatIOValue, formatMemUsage } from "./utils";

interface ContainerRowProps {
	container: ContainerInfo;
	stat: ContainerStat | undefined;
}

export const ContainerRow = ({ container, stat }: ContainerRowProps) => {
	const isRunning = container.CurrentState.startsWith("Running");
	const hasError = container.Error && container.Error.trim() !== "";

	const stateBadge = (
		<Badge
			variant={
				hasError ? "destructive" : isRunning ? "secondary" : "destructive"
			}
		>
			{container.CurrentState}
		</Badge>
	);

	return (
		<Table.Row>
			<Table.Cell>
				<div className="flex flex-col gap-1">
					<span className="font-medium text-sm">{container.Name}</span>
					<span className="text-xs text-muted-foreground truncate max-w-[230px]">
						{container.Image}
					</span>
				</div>
			</Table.Cell>
			<Table.Cell>
				{hasError ? (
					<TooltipProvider>
						<Tooltip
							content={
								<>
									<p className="text-xs font-medium">Error:</p>
									<p className="text-xs">{container.Error}</p>
								</>
							}
							side="top"
							className="max-w-xs"
							asChild
						>
							<span className="inline-flex items-center gap-1.5 cursor-help">
								{stateBadge}
								<AlertCircle className="h-3.5 w-3.5 text-destructive" />
							</span>
						</Tooltip>
					</TooltipProvider>
				) : (
					stateBadge
				)}
			</Table.Cell>
			<Table.Cell className="text-right">
				{stat ? (
					<span className="text-sm font-medium">{formatCpu(stat.CPUPerc)}</span>
				) : (
					<span className="text-xs text-muted-foreground">--</span>
				)}
			</Table.Cell>
			<Table.Cell className="text-right">
				{stat ? (
					<span className="text-sm font-medium">
						{formatMemUsage(stat.MemUsage)}
					</span>
				) : (
					<span className="text-xs text-muted-foreground">--</span>
				)}
			</Table.Cell>
			<Table.Cell className="text-right">
				{stat ? (
					<div className="flex items-center justify-end gap-1.5">
						<HardDrive className="h-3 w-3 text-muted-foreground" />
						<span className="text-sm">{formatIOValue(stat.BlockIO)}</span>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">--</span>
				)}
			</Table.Cell>
			<Table.Cell className="text-right">
				{stat ? (
					<div className="flex items-center justify-end gap-1.5">
						<Network className="h-3 w-3 text-muted-foreground" />
						<span className="text-sm">{formatIOValue(stat.NetIO)}</span>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">--</span>
				)}
			</Table.Cell>
		</Table.Row>
	);
};
