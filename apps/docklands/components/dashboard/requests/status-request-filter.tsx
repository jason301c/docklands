import { CheckIcon, PlusCircle } from "lucide-react";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Separator } from "@/components/shared/separator";
import { cn } from "@/shared/utils";

interface DataTableFacetedFilterProps {
	value?: string[];
	setValue?: (value: string[]) => void;
	title?: string;
	options: {
		label: string;
		value: string;
		icon?: React.ComponentType<{ className?: string }>;
	}[];
}

export function DataTableFacetedFilter({
	value = [],
	setValue,
	title,
	options,
}: DataTableFacetedFilterProps) {
	const selectedValues = new Set(value as string[]);

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button variant="outline" size="sm" className="h-8 border-dashed">
						<PlusCircle className="mr-2 h-4 w-4" />
						{title}
						{selectedValues.size > 0 && (
							<>
								<Separator orientation="vertical" className="mx-2 h-4" />
								<Badge
									variant="secondary"
									className="rounded-sm px-1 font-normal lg:hidden"
								>
									{selectedValues.size}
								</Badge>
								<div className="hidden space-x-1 lg:flex">
									{selectedValues.size > 2 ? (
										<Badge
											variant="secondary"
											className="rounded-sm px-1 font-normal"
										>
											{selectedValues.size} selected
										</Badge>
									) : (
										options
											.filter((option) => selectedValues.has(option.value))
											.map((option) => (
												<Badge
													variant="secondary"
													key={option.value}
													className="rounded-sm px-1 font-normal"
												>
													{option.label}
												</Badge>
											))
									)}
								</div>
							</>
						)}
					</Button>
				}
			/>
			<DropdownMenu.Content className="w-[200px]" align="start">
				<DropdownMenu.Group>
					{options.map((option) => {
						const isSelected = selectedValues.has(option.value);
						return (
							<DropdownMenu.CheckboxItem
								key={option.value}
								checked={isSelected}
								onCheckedChange={() => {
									if (isSelected) {
										selectedValues.delete(option.value);
									} else {
										selectedValues.add(option.value);
									}
									const filterValues = Array.from(selectedValues);
									setValue?.(filterValues.length ? filterValues : []);
								}}
							>
								<div
									className={cn(
										"mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
										isSelected
											? "bg-primary text-primary-foreground"
											: "opacity-50 [&_svg]:invisible",
									)}
								>
									<CheckIcon className="h-4 w-4" />
								</div>
								{option.icon && (
									<option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
								)}
								<span>{option.label}</span>
							</DropdownMenu.CheckboxItem>
						);
					})}
				</DropdownMenu.Group>
				{selectedValues.size > 0 && (
					<>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							onClick={() => setValue?.([])}
							className="justify-center text-center"
						>
							Clear filters
						</DropdownMenu.Item>
					</>
				)}
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}
