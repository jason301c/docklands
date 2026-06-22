import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Switch } from "@cloudflare/kumo/components/switch";
import { CheckIcon } from "lucide-react";
import { Separator } from "@/components/shared/separator";
import { cn } from "@/shared/utils";

export type TimeFilter = "all" | "1h" | "6h" | "24h" | "168h" | "720h";

const timeRanges: Array<{ label: string; value: TimeFilter }> = [
	{ label: "All time", value: "all" },
	{ label: "Last hour", value: "1h" },
	{ label: "Last 6 hours", value: "6h" },
	{ label: "Last 24 hours", value: "24h" },
	{ label: "Last 7 days", value: "168h" },
	{ label: "Last 30 days", value: "720h" },
] as const;

interface SinceLogsFilterProps {
	value: TimeFilter;
	onValueChange: (value: TimeFilter) => void;
	showTimestamp: boolean;
	onTimestampChange: (show: boolean) => void;
	title?: string;
}

export function SinceLogsFilter({
	value,
	onValueChange,
	showTimestamp,
	onTimestampChange,
	title = "Time range",
}: SinceLogsFilterProps) {
	const selectedLabel =
		timeRanges.find((range) => range.value === value)?.label ??
		"Select time range";

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="h-9 bg-input text-sm placeholder-gray-400 w-full sm:w-auto"
					>
						{title}
						<Separator orientation="vertical" className="mx-2 h-4" />
						<div className="space-x-1 flex">
							<Badge variant="neutral" className="rounded-sm px-1 font-normal">
								{selectedLabel}
							</Badge>
						</div>
					</Button>
				}
			/>
			<DropdownMenu.Content className="w-[200px]" align="start">
				<DropdownMenu.Group>
					{timeRanges.map((range) => {
						const isSelected = value === range.value;
						return (
							<DropdownMenu.Item
								key={range.value}
								onClick={() => {
									if (!isSelected) onValueChange(range.value);
								}}
							>
								<div
									className={cn(
										"mr-2 flex h-4 w-4 items-center rounded-sm border border-primary",
										isSelected
											? "bg-primary text-primary-foreground"
											: "opacity-50 [&_svg]:invisible",
									)}
								>
									<CheckIcon className="h-4 w-4" />
								</div>
								<span className="text-sm">{range.label}</span>
							</DropdownMenu.Item>
						);
					})}
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<div className="p-2 flex items-center justify-between">
					<span className="text-sm">Show timestamps</span>
					<Switch checked={showTimestamp} onCheckedChange={onTimestampChange} />
				</div>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}
