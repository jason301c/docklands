import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, YAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/shared/chart";

/**
 * One area series rendered by {@link AreaMetricChart}. `key` is the row field to
 * plot (and the gradient/color id), `label` shows in the legend, `color` is a
 * CSS color (e.g. `var(--chart-1)`), and `tooltipLabel` overrides the legend
 * label inside the tooltip (the originals showed e.g. "In" vs. the legend's
 * "In (MB)").
 */
export interface AreaMetricSeries {
	key: string;
	label: string;
	color: string;
	tooltipLabel?: string;
}

interface Props {
	/**
	 * Pre-transformed rows. Each row must carry a `time` field (ISO string used
	 * by the tooltip label) plus one numeric field per `series` key.
	 */
	data: Array<{ time: string } & Record<string, unknown>>;
	series: AreaMetricSeries[];
	/** Formats both the Y-axis ticks and the tooltip value (e.g. `(v) => `${v}%``). */
	valueFormatter: (value: string | number) => string;
	/** Optional fixed Y-axis domain; defaults to recharts auto-scaling. */
	yDomain?: [number, number];
	/** Whether to render the Y-axis tick formatter; some charts only format the tooltip. */
	formatYAxis?: boolean;
	/** Hide the legend (single-series disk chart renders without one). */
	hideLegend?: boolean;
}

/**
 * Shared area/timeseries chart for the container monitoring panels. The six
 * near-identical per-metric charts (CPU, memory, network, block, disk) collapse
 * to call sites that transform their raw stats into rows and describe the series
 * here, preserving the original gradient fills, time-based tooltips, and layout.
 */
export const AreaMetricChart = ({
	data,
	series,
	valueFormatter,
	yDomain,
	formatYAxis = true,
	hideLegend = false,
}: Props) => {
	const chartConfig = series.reduce<ChartConfig>((config, item) => {
		config[item.key] = { label: item.label, color: item.color };
		return config;
	}, {});

	return (
		<ChartContainer config={chartConfig} className="mt-4 h-[10rem] w-full">
			<AreaChart
				data={data}
				margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
			>
				<defs>
					{series.map((item) => (
						<linearGradient
							key={item.key}
							id={`fill-${item.key}`}
							x1="0"
							y1="0"
							x2="0"
							y2="1"
						>
							<stop
								offset="5%"
								stopColor={`var(--color-${item.key})`}
								stopOpacity={0.8}
							/>
							<stop
								offset="95%"
								stopColor={`var(--color-${item.key})`}
								stopOpacity={0.1}
							/>
						</linearGradient>
					))}
				</defs>
				<CartesianGrid vertical={false} />
				<YAxis
					tickFormatter={
						formatYAxis ? (value) => valueFormatter(value) : undefined
					}
					domain={yDomain}
					tickLine={false}
					axisLine={false}
				/>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							labelFormatter={(_, payload) => {
								const time = payload?.[0]?.payload?.time;
								return time ? format(new Date(time), "PPpp") : "";
							}}
							formatter={(value, name) => {
								const item = series.find((entry) => entry.key === name);
								const label = item?.tooltipLabel ?? item?.label ?? name;
								return [valueFormatter(value), label];
							}}
						/>
					}
				/>
				{series.map((item) => (
					<Area
						key={item.key}
						type="monotone"
						dataKey={item.key}
						stroke={`var(--color-${item.key})`}
						fill={`url(#fill-${item.key})`}
						strokeWidth={2}
					/>
				))}
				{!hideLegend && <ChartLegend content={<ChartLegendContent />} />}
			</AreaChart>
		</ChartContainer>
	);
};
