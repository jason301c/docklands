import { Input } from "@cloudflare/kumo/components/input";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { Info } from "lucide-react";
import { useState } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Select } from "@/components/shared/select";

export const commonCronExpressions = [
	{ label: "Every minute", value: "* * * * *" },
	{ label: "Every hour", value: "0 * * * *" },
	{ label: "Every day at midnight", value: "0 0 * * *" },
	{ label: "Every Sunday at midnight", value: "0 0 * * 0" },
	{ label: "Every month on the 1st at midnight", value: "0 0 1 * *" },
	{ label: "Every 15 minutes", value: "*/15 * * * *" },
	{ label: "Every weekday at midnight", value: "0 0 * * 1-5" },
	{ label: "Custom", value: "custom" },
];

/**
 * A reusable cron-expression form field: a preset-cadence picker plus a custom
 * cron expression input. Used by the database, compose-database, and volume
 * backup dialogs to schedule recurring jobs.
 */
export const ScheduleFormField = <TFieldValues extends FieldValues>({
	name,
	formControl,
}: {
	name: Path<TFieldValues>;
	formControl: Control<TFieldValues>;
}) => {
	const [selectedOption, setSelectedOption] = useState("");

	return (
		<FormField
			control={formControl}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel className="flex items-center gap-2">
						Cadence
						<TooltipProvider>
							<Tooltip
								content={
									<>
										<p>Cron expression format: minute hour day month weekday</p>
										<p>Example: 0 0 * * * (daily at midnight)</p>
									</>
								}
								asChild
							>
								<Info className="w-4 h-4 text-kumo-subtle cursor-help" />
							</Tooltip>
						</TooltipProvider>
					</FormLabel>
					<div className="flex flex-col gap-2">
						<FormControl>
							<Select
								aria-label="Cadence preset"
								value={selectedOption}
								onValueChange={(value) => {
									if (value === null) return;
									setSelectedOption(value);
									field.onChange(value === "custom" ? "" : value);
								}}
							>
								{commonCronExpressions.map((expr) => (
									<Select.Option key={expr.value} value={expr.value}>
										{expr.label}
										{expr.value !== "custom" && ` (${expr.value})`}
									</Select.Option>
								))}
							</Select>
						</FormControl>
						<div className="relative">
							<FormControl>
								<Input
									placeholder="Custom cron expression (e.g., 0 0 * * *)"
									{...field}
									onChange={(e) => {
										const value = e.target.value;
										const commonExpression = commonCronExpressions.find(
											(expression) => expression.value === value,
										);
										if (commonExpression) {
											setSelectedOption(commonExpression.value);
										} else {
											setSelectedOption("custom");
										}
										field.onChange(e);
									}}
								/>
							</FormControl>
						</div>
					</div>
					<FormDescription>
						Choose a preset cadence or enter a custom cron expression.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
};
