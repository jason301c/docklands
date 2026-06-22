import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { HardDrive } from "lucide-react";
import {
	Label,
	PolarGrid,
	PolarRadiusAxis,
	RadialBar,
	RadialBarChart,
} from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/shared/chart";

interface RadialChartProps {
	data: any;
}

export function DiskChart({ data }: RadialChartProps) {
	const diskUsed = Number.parseFloat(data.diskUsed || 0);
	const totalDiskGB = Number.parseFloat(data.totalDisk || 0);
	const usedDiskGB = (totalDiskGB * diskUsed) / 100;

	const chartData = [
		{
			disk: 25,
			fill: "var(--chart-2)",
		},
	];

	const chartConfig = {
		disk: {
			label: "Disk",
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;

	const endAngle = (diskUsed * 360) / 100;

	return (
		<LayerCard className="flex flex-col bg-transparent">
			<div className="items-center border-b pb-5">
				<h3>Disk</h3>
				<p>Storage Space</p>
			</div>
			<div className="flex-1 pb-0">
				<ChartContainer
					config={chartConfig}
					className="mx-auto aspect-square max-h-[250px]"
				>
					<RadialBarChart
						data={chartData}
						startAngle={0}
						endAngle={endAngle}
						innerRadius={80}
						outerRadius={110}
					>
						<PolarGrid
							gridType="circle"
							radialLines={false}
							stroke="none"
							className="first:fill-kumo-fill last:fill-kumo-canvas"
							polarRadius={[86, 74]}
						/>
						<RadialBar
							dataKey="disk"
							background
							cornerRadius={10}
							fill="var(--chart-2)"
						/>
						<PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
							<Label
								content={({ viewBox }: any) => {
									if (viewBox && "cx" in viewBox && "cy" in viewBox) {
										return (
											<text
												x={viewBox.cx}
												y={viewBox.cy}
												textAnchor="middle"
												dominantBaseline="middle"
											>
												<tspan
													x={viewBox.cx}
													y={viewBox.cy}
													className="fill-kumo-default text-4xl font-bold"
												>
													{diskUsed.toFixed(1)}%
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy || 0) + 24}
													className="fill-kumo-subtle text-sm"
												>
													Used
												</tspan>
											</text>
										);
									}
								}}
							/>
						</PolarRadiusAxis>
					</RadialBarChart>
				</ChartContainer>
			</div>
			<div className="flex-col gap-2 text-sm">
				<div className="flex items-center gap-2 font-medium leading-none">
					<HardDrive className="h-4 w-4" /> {usedDiskGB.toFixed(1)} GB used
				</div>
				<div className="leading-none text-kumo-subtle">
					Of {totalDiskGB.toFixed(1)} GB total
				</div>
			</div>
		</LayerCard>
	);
}
