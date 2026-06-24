import { Badge } from "@cloudflare/kumo/components/badge";
import {
	type Node,
	type NodeProps,
	NodeResizer,
	type ResizeParams,
} from "@xyflow/react";
import { Folder, MoreVertical } from "lucide-react";
import { DropdownMenu } from "@/components/shared/dropdown";
import { cn } from "@/shared/utils";

/**
 * Default accent used when a group has no stored color. Kept as a CSS token so
 * the tint follows the active theme.
 */
export const GROUP_DEFAULT_COLOR = "var(--color-kumo-brand)";

export type GroupNodeData = {
	groupId: string;
	name: string;
	color: string | null;
	memberCount: number;
	canManage: boolean;
	onEdit: (groupId: string) => void;
	onDelete: (groupId: string) => void;
	onResizeEnd: (
		groupId: string,
		geometry: { x: number; y: number; width: number; height: number },
	) => void;
};

export type GroupFlowNode = Node<GroupNodeData, "group">;

/**
 * A named, colored container region rendered *behind* the service cards. The
 * group is its own positioned/sized React Flow node (lower z-index than
 * services); services belong to it via membership metadata, never via React Flow
 * parent/child reparenting — so dragging a group never moves its members and
 * vice versa. Position is persisted by the canvas on drag-stop; size here on
 * resize-end.
 */
export const GroupNode = ({ data, selected }: NodeProps<GroupFlowNode>) => {
	const accent = data.color || GROUP_DEFAULT_COLOR;

	return (
		<div className="group/region h-full w-full">
			{data.canManage && (
				<NodeResizer
					minWidth={240}
					minHeight={160}
					isVisible={selected}
					lineClassName="!border-kumo-brand/40"
					handleClassName="!size-2.5 !rounded-sm !border-kumo-brand !bg-kumo-canvas"
					onResizeEnd={(_, params: ResizeParams) =>
						data.onResizeEnd(data.groupId, {
							x: Math.round(params.x),
							y: Math.round(params.y),
							width: Math.round(params.width),
							height: Math.round(params.height),
						})
					}
				/>
			)}
			<div
				className={cn(
					"flex h-full w-full flex-col rounded-xl border-2 transition",
					selected ? "border-solid" : "border-dashed",
				)}
				style={{
					borderColor: accent,
					backgroundColor: `color-mix(in srgb, ${accent} 8%, transparent)`,
				}}
			>
				<div className="flex items-center justify-between gap-2 px-3 py-2">
					<div className="flex min-w-0 items-center gap-2">
						<span
							className="flex size-6 shrink-0 items-center justify-center rounded-md"
							style={{
								backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`,
								color: accent,
							}}
						>
							<Folder className="size-3.5" />
						</span>
						<span className="truncate text-sm font-semibold">{data.name}</span>
						<Badge>{data.memberCount}</Badge>
					</div>
					{data.canManage && (
						<DropdownMenu>
							<DropdownMenu.Trigger
								render={
									(
										<button
											type="button"
											aria-label={`Group ${data.name} actions`}
											className="nodrag flex size-6 shrink-0 items-center justify-center rounded-md text-kumo-subtle opacity-60 transition hover:bg-kumo-fill/60 hover:opacity-100 group-hover/region:opacity-100"
										>
											<MoreVertical className="size-4" />
										</button>
									) as never
								}
							/>
							<DropdownMenu.Content className="w-[180px]" align="end">
								<DropdownMenu.Item
									className="cursor-pointer"
									onClick={() => data.onEdit(data.groupId)}
								>
									Rename &amp; recolor
								</DropdownMenu.Item>
								<DropdownMenu.Separator />
								<DropdownMenu.Item
									className="cursor-pointer text-kumo-danger"
									onClick={() => data.onDelete(data.groupId)}
								>
									Delete group
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu>
					)}
				</div>
			</div>
		</div>
	);
};
