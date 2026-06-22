import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { CheckIcon } from "lucide-react";
import type React from "react";
import { Separator } from "@/components/shared/separator";
import { cn } from "@/shared/utils";

interface StatusLogsFilterProps {
	value?: string[];
	setValue?: (value: string[]) => void;
	title?: string;
	options: {
		label: string;
		value: string;
		icon?: React.ComponentType<{ className?: string }>;
	}[];
}

export function StatusLogsFilter({
	value = [],
	setValue,
	title,
	options,
}: StatusLogsFilterProps) {
	const selectedValues = new Set(value as string[]);
	const allSelected = selectedValues.size === 0;

	const getVariant = (status?: string) =>
		status === "success"
			? "green"
			: status === "error"
				? "red"
				: status === "warning"
					? "orange"
					: status === "info"
						? "blue"
						: status === "debug"
							? "warning"
							: "neutral";

	const getSelectedBadges = () => {
		if (allSelected) {
			return (
				<Badge variant="neutral" className="rounded-sm px-1 font-normal">
					All
				</Badge>
			);
		}

		const selected = options.find((opt) => selectedValues.has(opt.value));
		return (
			<>
				<Badge
					variant={getVariant(selected?.value)}
					className="rounded-sm px-1 font-normal"
				>
					{selected?.label}
				</Badge>
				{selectedValues.size > 1 && (
					<Badge variant="neutral" className="rounded-sm px-1 font-normal">
						+{selectedValues.size - 1}
					</Badge>
				)}
			</>
		);
	};

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="h-9 bg-kumo-fill text-sm placeholder:text-kumo-placeholder w-full sm:w-auto"
					>
						{title}
						<Separator orientation="vertical" className="mx-2 h-4" />
						<div className="space-x-1 flex">{getSelectedBadges()}</div>
					</Button>
				}
			/>
			<DropdownMenu.Content className="w-[200px]" align="start">
				<DropdownMenu.Group>
					<DropdownMenu.CheckboxItem
						checked={allSelected}
						onCheckedChange={() => setValue?.([])}
					>
						<div
							className={cn(
								"mr-2 flex h-4 w-4 items-center rounded-sm border border-kumo-brand",
								allSelected
									? "bg-kumo-brand text-kumo-inverse"
									: "opacity-50 [&_svg]:invisible",
							)}
						>
							<CheckIcon className="h-4 w-4" />
						</div>
						<Badge variant="neutral">All</Badge>
					</DropdownMenu.CheckboxItem>
					{options.map((option) => {
						const isSelected = selectedValues.has(option.value);
						return (
							<DropdownMenu.CheckboxItem
								key={option.value}
								checked={isSelected}
								onCheckedChange={() => {
									const newValues = new Set(selectedValues);
									if (isSelected) {
										newValues.delete(option.value);
									} else {
										newValues.add(option.value);
									}
									setValue?.(Array.from(newValues));
								}}
							>
								<div
									className={cn(
										"mr-2 flex h-4 w-4 items-center rounded-sm border border-kumo-brand",
										isSelected
											? "bg-kumo-brand text-kumo-inverse"
											: "opacity-50 [&_svg]:invisible",
									)}
								>
									<CheckIcon className="h-4 w-4" />
								</div>
								{option.icon && (
									<option.icon className="mr-2 h-4 w-4 text-kumo-subtle" />
								)}
								<Badge variant={getVariant(option.value)}>{option.label}</Badge>
							</DropdownMenu.CheckboxItem>
						);
					})}
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}
