import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Combobox } from "@cloudflare/kumo/components/combobox";
import { Check } from "lucide-react";
import { HandleTag } from "@/components/dashboard/shared/handle-tag";
import { TagBadge } from "@/components/shared/tag-badge";
import { cn } from "@/shared/utils";

export interface Tag {
	id: string;
	name: string;
	color?: string;
}

interface TagSelectorProps {
	tags: Tag[];
	selectedTags: string[];
	onTagsChange: (tagIds: string[]) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
}

export function TagSelector({
	tags,
	selectedTags,
	onTagsChange,
	placeholder = "Select tags...",
	className,
	disabled = false,
}: TagSelectorProps) {
	const selectedTagObjects = tags.filter((tag) =>
		selectedTags.includes(tag.id),
	);

	return (
		<div className={cn("w-full", className)}>
			<Combobox
				multiple
				items={tags}
				value={selectedTagObjects}
				disabled={disabled}
				itemToStringValue={(tag: Tag) => tag.name}
				onValueChange={(value) => {
					onTagsChange((value as Tag[]).map((tag) => tag.id));
				}}
			>
				<Combobox.TriggerMultipleWithInput
					placeholder={placeholder}
					value={selectedTagObjects}
					renderItem={(tag: Tag) => (
						<Combobox.Chip removeLabel={`Remove ${tag.name}`}>
							<TagBadge name={tag.name} color={tag.color} />
						</Combobox.Chip>
					)}
					className={cn(disabled && "cursor-not-allowed opacity-50")}
				/>
				<Combobox.Content align="start">
					{tags.length === 0 && (
						<div className="flex flex-col items-center gap-2 py-4">
							<span className="text-sm text-kumo-subtle">
								No tags created yet.
							</span>
							<HandleTag />
						</div>
					)}
					<Combobox.List>
						{(tag: Tag) => {
							const isSelected = selectedTags.includes(tag.id);
							return (
								<Combobox.Item key={tag.id} value={tag}>
									<Checkbox checked={isSelected} className="mr-2" />
									<TagBadge
										name={tag.name}
										color={tag.color}
										className="mr-2"
									/>
									<Check
										className={cn(
											"ml-auto h-4 w-4",
											isSelected ? "opacity-100" : "opacity-0",
										)}
									/>
								</Combobox.Item>
							);
						}}
					</Combobox.List>
					<Combobox.Empty>
						<div className="flex flex-col items-center gap-2 py-1">
							<span className="text-sm text-kumo-subtle">No tags found.</span>
							<HandleTag />
						</div>
					</Combobox.Empty>
				</Combobox.Content>
			</Combobox>
		</div>
	);
}
