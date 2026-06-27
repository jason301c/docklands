import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

interface PageHeaderProps {
	title: ReactNode;
	/** Optional trailing actions, right-aligned on wide viewports. */
	actions?: ReactNode;
	className?: string;
}

/**
 * Standard dashboard page/section header: a large Fraunces display-serif title
 * with an optional right-aligned actions slot. Every dashboard section uses this
 * one look — there is no icon, description, or size variant; the heading is
 * always the large serif "page heading" (what the Workspaces overview uses).
 */
export function PageHeader({ title, actions, className }: PageHeaderProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			<h3 className="font-display font-semibold text-3xl tracking-tight">
				{title}
			</h3>
			{actions ? (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
