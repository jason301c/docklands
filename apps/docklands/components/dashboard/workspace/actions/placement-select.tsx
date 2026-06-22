import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { HelpCircle } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormMessage } from "@/components/shared/form";

type RuntimeWorkerOption = {
	runtimeWorkerId: string;
	name: string;
	ipAddress?: string | null;
};

type PlacementSelectProps = {
	ariaLabel: string;
	label?: string;
	value?: string | null;
	onValueChange: (value: string) => void;
	workers?: RuntimeWorkerOption[];
	showAutomaticPlacement: boolean;
	optional?: boolean;
	description: string;
};

export const PlacementSelect = ({
	ariaLabel,
	label = "Placement",
	value,
	onValueChange,
	workers,
	showAutomaticPlacement,
	optional = false,
	description,
}: PlacementSelectProps) => {
	const workerCount = (workers?.length ?? 0) + (showAutomaticPlacement ? 1 : 0);
	const defaultValue =
		value || (showAutomaticPlacement ? "docklands" : undefined);

	return (
		<div className="grid gap-2">
			<TooltipProvider delay={0}>
				<Tooltip
					content={<span>{description}</span>}
					className="z-[999] w-[300px]"
					align="start"
					side="top"
					asChild
				>
					<Label className="break-all w-fit flex flex-row gap-1 items-center">
						{label} {optional ? "(Optional)" : ""}
						<HelpCircle className="size-4 text-kumo-subtle" />
					</Label>
				</Tooltip>
			</TooltipProvider>

			<Select
				aria-label={ariaLabel}
				onValueChange={(nextValue) => {
					if (nextValue !== null) {
						onValueChange(nextValue);
					}
				}}
				defaultValue={defaultValue}
			>
				<></>
				<>
					<Select.Group>
						{showAutomaticPlacement && (
							<Select.Option value="docklands">
								<span className="flex items-center gap-2 justify-between w-full">
									<span>Automatic placement</span>
									<span className="text-kumo-subtle text-xs self-center">
										Default
									</span>
								</span>
							</Select.Option>
						)}
						{workers?.map((worker) => (
							<Select.Option
								key={worker.runtimeWorkerId}
								value={worker.runtimeWorkerId}
							>
								<span className="flex items-center gap-2 justify-between w-full">
									<span>{worker.name}</span>
									{worker.ipAddress && (
										<span className="text-kumo-subtle text-xs self-center">
											{worker.ipAddress}
										</span>
									)}
								</span>
							</Select.Option>
						))}
						<Select.GroupLabel>
							Runtime workers ({workerCount})
						</Select.GroupLabel>
					</Select.Group>
				</>
			</Select>
		</div>
	);
};

type PlacementFormFieldProps<T extends FieldValues> = Omit<
	PlacementSelectProps,
	"value" | "onValueChange"
> & {
	control: Control<T>;
	name: FieldPath<T>;
};

export function PlacementFormField<T extends FieldValues>({
	control,
	name,
	...props
}: PlacementFormFieldProps<T>) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<PlacementSelect
						{...props}
						value={typeof field.value === "string" ? field.value : undefined}
						onValueChange={field.onChange}
					/>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
