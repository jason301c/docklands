import { Check, Tags } from "lucide-react";
import { HandleTag } from "@/components/dashboard/settings/tags/handle-tag";
import { TagBadge } from "@/components/shared/tag-badge";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Combobox } from "@cloudflare/kumo/components/combobox";
import { cn } from "@/shared/utils";

export interface Tag {
	id: string;
	name: string;
	color?: string;
}

interface TagFilterProps {
	tags: Tag[];
	selectedTags: string[];
	onTagsChange: (tagIds: string[]) => void;
	className?: string;
}

export function TagFilter({
	tags,
	selectedTags,
	onTagsChange,
	className,
}: TagFilterProps) {
	const selectedTagObjects = tags.filter((tag) => selectedTags.includes(tag.id));

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Combobox
				multiple
				items={tags}
				value={selectedTagObjects}
				itemToStringValue={(tag: Tag) => tag.name}
				onValueChange={(value) => {
					onTagsChange((value as Tag[]).map((tag) => tag.id));
				}}
			>
				<Combobox.TriggerMultipleWithInput
					placeholder="Tags"
					value={selectedTagObjects}
					renderItem={(tag: Tag) => (
						<Combobox.Chip removeLabel={`Remove ${tag.name}`}>
							<TagBadge name={tag.name} color={tag.color} />
						</Combobox.Chip>
					)}
					className={cn(selectedTags.length > 0 && "border-primary")}
				/>
				<Combobox.Content align="start" className="w-64">
					{selectedTags.length > 0 && (
						<div className="flex items-center justify-between border-b px-3 py-2">
							<div className="flex items-center gap-2 text-sm">
								<Tags className="h-4 w-4" />
								<Badge variant="secondary" className="px-1 py-0">
									{selectedTags.length}
								</Badge>
							</div>
							<button
								type="button"
								onClick={() => onTagsChange([])}
								className="text-xs text-muted-foreground hover:text-foreground"
							>
								Clear
							</button>
						</div>
					)}
					<Combobox.List>
						{(tag: Tag) => {
							const isSelected = selectedTags.includes(tag.id);
							return (
								<Combobox.Item key={tag.id} value={tag}>
									<Checkbox checked={isSelected} className="mr-2" />
									<TagBadge name={tag.name} color={tag.color} />
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
							<span className="text-sm text-muted-foreground">No tags found.</span>
							<HandleTag />
						</div>
					</Combobox.Empty>
				</Combobox.Content>
			</Combobox>
		</div>
	);
}
