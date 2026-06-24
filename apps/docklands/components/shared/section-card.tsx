import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSection } from "@/components/shared/page-section";
import { cn } from "@/shared/utils";

interface SectionCardProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	title: ReactNode;
	description?: ReactNode;
	/** Optional leading icon (e.g. a lucide icon component). */
	icon?: ComponentType<{ className?: string }>;
	/** Optional trailing header actions, right-aligned on wide viewports. */
	actions?: ReactNode;
	/**
	 * Title scale. `"sm"` (default) is the standard section heading; `"lg"` is a
	 * larger page heading and renders in the Fraunces display serif automatically.
	 */
	size?: "sm" | "lg";
	/** Force the Fraunces display serif even at `"sm"` size (`"lg"` is always serif). */
	serif?: boolean;
	/** Extra classes for the body region below the header divider. */
	contentClassName?: string;
	children?: ReactNode;
}

/**
 * Canonical titled dashboard section: a bordered {@link PageSection} card with a
 * {@link PageHeader} (icon + title + subtle description + optional actions), a
 * hairline divider, and a body.
 *
 * Section surfaces across the app — SSH keys, certificates, users, ingress,
 * runtime containers, ingress files, requests, database backups, etc. —
 * previously hand-rolled `rounded-lg border bg-kumo-canvas p-6` + an `<h3>`/`<p>`
 * header + a `space-y-* py-* border-t` divider, and they drifted apart (py-6 vs
 * py-8, space-y-2 vs space-y-6, descriptions sometimes `text-kumo-subtle` and
 * sometimes unstyled, one card missing the divider entirely). This bakes the one
 * agreed look in once so the sections read consistently.
 *
 * ```tsx
 * <SectionCard
 *   icon={KeyRound}
 *   title="SSH Keys"
 *   description="Create and manage SSH keys."
 *   actions={<AddSshKey />}
 * >
 *   {body}
 * </SectionCard>
 * ```
 *
 * Defaults merge via tailwind-merge, so a call site can still override — e.g.
 * `contentClassName="space-y-6"` for body rhythm, or `className="gap-0"`.
 *
 * It defaults to `flex-1` so a section that is the sole child of the dashboard
 * layout's full-height column stretches to fill the page; in a content-height
 * wrapper (multiple stacked sections) this is a no-op. Pass `className="grow-0"`
 * to opt out.
 */
export function SectionCard({
	title,
	description,
	icon,
	actions,
	size,
	serif,
	children,
	className,
	contentClassName,
	...props
}: SectionCardProps) {
	return (
		<PageSection className={cn("flex-1 gap-4", className)} {...props}>
			<PageHeader
				title={title}
				description={description}
				icon={icon}
				actions={actions}
				size={size}
				serif={serif}
				className="border-b border-kumo-hairline pb-4"
			/>
			{children != null ? (
				<div className={cn("pt-2", contentClassName)}>{children}</div>
			) : null}
		</PageSection>
	);
}
