import type { ComponentType, ReactNode } from "react";
import { cn } from "@/shared/utils";

interface PageHeaderProps {
	title: ReactNode;
	description?: ReactNode;
	/** Optional leading icon (e.g. a lucide icon component). */
	icon?: ComponentType<{ className?: string }>;
	/** Optional trailing actions, right-aligned on wide viewports. */
	actions?: ReactNode;
	className?: string;
}

/**
 * Standard dashboard page/section header: a bold title with an optional
 * leading icon, a subtle description, and an optional right-aligned actions
 * slot. Replaces the per-page hand-rolled `<h3>`/`<p>` header markup.
 */
export function PageHeader({
	title,
	description,
	icon: Icon,
	actions,
	className,
}: PageHeaderProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
				className,
			)}
		>
			<div className="space-y-1">
				<h3 className="flex items-center gap-2 text-xl font-semibold">
					{Icon ? <Icon className="size-5" /> : null}
					{title}
				</h3>
				{description ? (
					<p className="text-sm text-kumo-subtle">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
