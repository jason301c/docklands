import type { HTMLAttributes } from "react";
import { cn } from "@/shared/utils";

/**
 * Standard dashboard page panel: a bordered surface on the canvas with
 * consistent radius, padding, and vertical rhythm. Replaces the hand-rolled
 * `rounded-lg border bg-kumo-canvas p-6` divs that were duplicated per page.
 */
export function PageSection({
	className,
	children,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex w-full flex-col gap-6 rounded-lg border border-kumo-hairline bg-kumo-canvas p-6",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
