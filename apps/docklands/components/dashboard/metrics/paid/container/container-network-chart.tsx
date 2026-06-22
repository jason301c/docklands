import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
} from "@/components/shared/chart";
import { formatTimestamp } from "@/shared/utils";

interface ContainerMetric {
	timestamp: string;
	Network: {
		input: number;
		output: number;
		inputUnit: string;
		outputUnit: string;
	};
}

interface Props {
	data: ContainerMetric[];
}

interface FormattedMetric {
	timestamp: string;
	input: number;
	output: number;
	inputUnit: string;
	outputUnit: string;
}

const chartConfig = {
	input: {
		label: "Input",
		color: "var(--chart-3)",
	},
	output: {
		label: "Output",
		color: "var(--chart-4)",
	},
} satisfies ChartConfig;

export const ContainerNetworkChart = ({ data }: Props) => {
	const formattedData: FormattedMetric[] = data.map((metric) => ({
		timestamp: metric.timestamp,
		input: metric.Network.input,
		output: metric.Network.output,
		inputUnit: metric.Network.inputUnit,
		outputUnit: metric.Network.outputUnit,
	}));

	const latestData = formattedData[formattedData.length - 1] || {
		input: 0,
		output: 0,
		inputUnit: "B",
		outputUnit: "B",
	};

	return (
		<LayerCard className="bg-transparent">
			<div className="border-b py-5">
				<h3>Network I/O</h3>
				<p>
					Input: {latestData.input}
					{latestData.inputUnit} / Output: {latestData.output}
					{latestData.outputUnit}
				</p>
			</div>
			<div className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<AreaChart data={formattedData}>
						<defs>
							<linearGradient id="fillInput" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--chart-3)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--chart-3)"
									stopOpacity={0.1}
								/>
							</linearGradient>
							<linearGradient id="fillOutput" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--chart-4)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--chart-4)"
									stopOpacity={0.1}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="timestamp"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value) => formatTimestamp(value)}
						/>
						<YAxis />
						<ChartTooltip
							cursor={false}
							content={({ active, payload, label }: any) => {
								if (active && payload?.length) {
									const data = payload?.[0]?.payload;
									return (
										<div className="rounded-lg border bg-kumo-canvas p-2 shadow-sm">
											<div className="grid grid-cols-2 gap-2">
												<div className="flex flex-col">
													<span className="text-[0.70rem] uppercase text-kumo-subtle">
														Time
													</span>
													<span className="font-bold">
														{formatTimestamp(label ?? "")}
													</span>
												</div>
												<div className="flex flex-col">
													<span className="text-[0.70rem] uppercase text-kumo-subtle">
														Input
													</span>
													<span className="font-bold">
														{data.input}
														{data.inputUnit}
													</span>
												</div>
												<div className="flex flex-col">
													<span className="text-[0.70rem] uppercase text-kumo-subtle">
														Output
													</span>
													<span className="font-bold">
														{data.output}
														{data.outputUnit}
													</span>
												</div>
											</div>
										</div>
									);
								}
								return null;
							}}
						/>
						<Area
							name="Input"
							dataKey="input"
							type="monotone"
							fill="url(#fillInput)"
							stroke="var(--chart-3)"
							strokeWidth={2}
						/>
						<Area
							name="Output"
							dataKey="output"
							type="monotone"
							fill="url(#fillOutput)"
							stroke="var(--chart-4)"
							strokeWidth={2}
						/>
						<ChartLegend
							content={<ChartLegendContent />}
							verticalAlign="bottom"
							align="center"
						/>
					</AreaChart>
				</ChartContainer>
			</div>
		</LayerCard>
	);
};
