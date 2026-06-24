import type { HTMLAttributes, ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSection } from "@/components/shared/page-section";
import { cn } from "@/shared/utils";

interface SectionCardProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	title: ReactNode;
	/** Optional trailing header actions, right-aligned on wide viewports. */
	actions?: ReactNode;
	/** Extra classes for the body region below the header divider. */
	contentClassName?: string;
	children?: ReactNode;
}

/**
 * Canonical titled dashboard section: a bordered {@link PageSection} card with a
 * {@link PageHeader} (a large serif title + optional actions), a hairline
 * divider, and a body.
 *
 * Every section surface across the app uses this one look — the large serif
 * "page heading" the Workspaces overview uses, with no icon or description. This
 * bakes the one agreed look in once so the sections read consistently.
 *
 * ```tsx
 * <SectionCard title="SSH Keys" actions={<AddSshKey />}>
 *   {body}
 * </SectionCard>
 * ```
 *
 * It defaults to `flex-1` so a section that is the sole child of the dashboard
 * layout's full-height column stretches to fill the page; in a content-height
 * wrapper (multiple stacked sections) this is a no-op. Pass `className="grow-0"`
 * to opt out.
 */
export function SectionCard({
	title,
	actions,
	children,
	className,
	contentClassName,
	...props
}: SectionCardProps) {
	return (
		<PageSection className={cn("flex-1 gap-4", className)} {...props}>
			<PageHeader
				title={title}
				actions={actions}
				className="border-b border-kumo-hairline pb-4"
			/>
			{children != null ? (
				<div className={cn("pt-2", contentClassName)}>{children}</div>
			) : null}
		</PageSection>
	);
}
