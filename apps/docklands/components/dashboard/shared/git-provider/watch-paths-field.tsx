import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { HelpCircle, Plus, X } from "lucide-react";
import type { ControllerRenderProps } from "react-hook-form";
import {
	FormControl,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";

/**
 * The watch-paths editor appears in three distinct markups across the
 * git-provider save forms; all three are preserved here verbatim so the shared
 * form stays pixel/behavior identical to the originals.
 *
 * - "plus": square outline `Plus` button driving `field.onChange`, with the
 *   "gap" badge style and a bare (un-wrapped) input. Used by the GitHub/GitLab/
 *   Gitea application forms.
 * - "add": secondary text "Add" button driving `setWatchPaths`, with the "plain"
 *   badge style and the whole add-row wrapped in a single `FormControl`. Used by
 *   the Bitbucket application form and the GitHub/GitLab/Bitbucket compose forms.
 * - "plus-hybrid": the "add" badge/input markup (plain badge + `setWatchPaths`
 *   removal + input in `FormControl`) but with the `Plus` button from "plus"
 *   (driving `field.onChange`). Used only by the Gitea compose form.
 */
export type WatchPathsVariant = "plus" | "add" | "plus-hybrid";

/** The tooltip trigger icon differs: a lucide `HelpCircle` or a `?` chip. */
export type WatchPathsTooltipIcon = "help-circle" | "question-mark";

interface WatchPathsFieldProps {
	field: ControllerRenderProps<any, "watchPaths">;
	variant: WatchPathsVariant;
	tooltipIcon: WatchPathsTooltipIcon;
	/** Whether the tooltip is rendered with `asChild`. */
	tooltipAsChild: boolean;
	/**
	 * Set the watch-paths value. Mirrors the original form's chosen mechanism —
	 * `field.onChange` for the "plus" variant or `form.setValue("watchPaths", …)`
	 * for the "add"/"plus-hybrid" variants.
	 */
	setWatchPaths: (paths: string[]) => void;
}

const WatchPathsTooltip = ({
	tooltipIcon,
	tooltipAsChild,
}: Pick<WatchPathsFieldProps, "tooltipIcon" | "tooltipAsChild">) => (
	<TooltipProvider>
		<Tooltip
			content={
				<>
					<p>
						Add paths to watch for changes. When files in these paths change, a
						new build will be triggered.
					</p>
				</>
			}
			asChild={tooltipAsChild}
		>
			{tooltipIcon === "help-circle" ? (
				<HelpCircle className="size-4 text-kumo-subtle hover:text-kumo-default transition-colors cursor-pointer" />
			) : (
				<div className="size-4 rounded-full bg-kumo-fill flex items-center justify-center text-[10px] font-bold">
					?
				</div>
			)}
		</Tooltip>
	</TooltipProvider>
);

/** The square outline `Plus` button shared by the "plus" and "plus-hybrid" variants. */
const PlusAddButton = ({
	field,
}: {
	field: ControllerRenderProps<any, "watchPaths">;
}) => (
	<Button
		aria-label="Add watch path"
		type="button"
		variant="outline"
		shape="square"
		onClick={() => {
			const input = document.querySelector(
				'input[placeholder*="Enter a path"]',
			) as HTMLInputElement;
			const path = input.value.trim();
			if (path) {
				field.onChange([...(field.value || []), path]);
				input.value = "";
			}
		}}
	>
		<Plus className="size-4" />
	</Button>
);

export const WatchPathsField = ({
	field,
	variant,
	tooltipIcon,
	tooltipAsChild,
	setWatchPaths,
}: WatchPathsFieldProps) => {
	if (variant === "plus") {
		return (
			<FormItem className="md:col-span-2">
				<div className="flex items-center gap-2">
					<FormLabel>Watch Paths</FormLabel>
					<WatchPathsTooltip
						tooltipIcon={tooltipIcon}
						tooltipAsChild={tooltipAsChild}
					/>
				</div>
				<div className="flex flex-wrap gap-2 mb-2">
					{field.value?.map((path: string, index: number) => (
						<Badge
							key={`${path}-${index}`}
							variant="secondary"
							className="flex items-center gap-1"
						>
							{path}
							<X
								className="size-3 cursor-pointer hover:text-kumo-danger"
								onClick={() => {
									const newPaths = [...(field.value || [])];
									newPaths.splice(index, 1);
									field.onChange(newPaths);
								}}
							/>
						</Badge>
					))}
				</div>
				<div className="flex gap-2">
					<FormControl>
						<Input
							placeholder="Enter a path to watch (e.g., src/**, dist/*.js)"
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									const input = e.currentTarget;
									const path = input.value.trim();
									if (path) {
										field.onChange([...(field.value || []), path]);
										input.value = "";
									}
								}
							}}
						/>
					</FormControl>
					<PlusAddButton field={field} />
				</div>
				<FormMessage />
			</FormItem>
		);
	}

	// "add" and "plus-hybrid" share the plain badge, the `setWatchPaths` removal,
	// and the `FormControl`-wrapped input row; they differ only in the add button.
	return (
		<FormItem className="md:col-span-2">
			<div className="flex items-center gap-2">
				<FormLabel>Watch Paths</FormLabel>
				<WatchPathsTooltip
					tooltipIcon={tooltipIcon}
					tooltipAsChild={tooltipAsChild}
				/>
			</div>
			<div className="flex flex-wrap gap-2 mb-2">
				{field.value?.map((path: string, index: number) => (
					<Badge key={index} variant="secondary">
						{path}
						<X
							className="ml-1 size-3 cursor-pointer"
							onClick={() => {
								const newPaths = [...(field.value || [])];
								newPaths.splice(index, 1);
								setWatchPaths(newPaths);
							}}
						/>
					</Badge>
				))}
			</div>
			<FormControl>
				<div className="flex gap-2">
					<Input
						placeholder="Enter a path to watch (e.g., src/**, dist/*.js)"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								const input = e.currentTarget;
								const value = input.value.trim();
								if (value) {
									const newPaths = [...(field.value || []), value];
									setWatchPaths(newPaths);
									input.value = "";
								}
							}
						}}
					/>
					{variant === "plus-hybrid" ? (
						<PlusAddButton field={field} />
					) : (
						<Button
							type="button"
							variant="secondary"
							onClick={() => {
								const input = document.querySelector(
									'input[placeholder="Enter a path to watch (e.g., src/**, dist/*.js)"]',
								) as HTMLInputElement;
								const value = input.value.trim();
								if (value) {
									const newPaths = [...(field.value || []), value];
									setWatchPaths(newPaths);
									input.value = "";
								}
							}}
						>
							Add
						</Button>
					)}
				</div>
			</FormControl>
			<FormMessage />
		</FormItem>
	);
};
