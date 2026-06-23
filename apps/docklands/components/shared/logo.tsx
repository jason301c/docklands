import { cn } from "@/shared/utils";

interface Props {
	className?: string;
	logoUrl?: string;
}

/**
 * The Docklands logo. When `logoUrl` is set (a custom organization logo) we
 * render that image; otherwise we render the inline Docklands mark below.
 */
export const Logo = ({ className = "size-14", logoUrl }: Props) => {
	if (logoUrl) {
		return (
			<img
				src={logoUrl}
				alt="Organization Logo"
				className={cn(className, "rounded-sm object-contain")}
			/>
		);
	}
	return <DocklandsLogo className={cn(className, "text-kumo-strong")} />;
};

/**
 * Docklands brand mark — three stacked containers with the top one highlighted
 * as the "deploying" container (the brand-colored bar). The lower two bars use
 * `currentColor`, so the mark adapts to the surrounding text color (dark on
 * light surfaces, light on dark), while the accent tracks the Kumo brand token.
 */
export const DocklandsLogo = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 512 512"
		className={className}
		role="img"
		aria-label="Docklands"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect x="116" y="316" width="280" height="76" rx="20" fill="currentColor" />
		<rect x="116" y="222" width="280" height="76" rx="20" fill="currentColor" />
		<rect
			x="116"
			y="128"
			width="280"
			height="76"
			rx="20"
			fill="var(--color-kumo-brand)"
		/>
	</svg>
);
