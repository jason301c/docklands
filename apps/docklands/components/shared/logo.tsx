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
 * Docklands brand mark — a container ship carrying a 3/2/1 stack of containers
 * with one highlighted "deploying" container (the orange apex). The hull and
 * containers use `currentColor`, so the mark adapts to the surrounding text
 * color (dark on light surfaces, light on dark) while the accent stays fixed.
 */
export const DocklandsLogo = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 512 512"
		className={className}
		role="img"
		aria-label="Docklands"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M64 300 H448 L414 416 Q256 450 98 416 L64 300 Z"
			fill="currentColor"
		/>
		<rect x="134" y="224" width="76" height="76" rx="14" fill="currentColor" />
		<rect x="218" y="224" width="76" height="76" rx="14" fill="currentColor" />
		<rect x="302" y="224" width="76" height="76" rx="14" fill="currentColor" />
		<rect x="176" y="144" width="76" height="76" rx="14" fill="currentColor" />
		<rect x="260" y="144" width="76" height="76" rx="14" fill="currentColor" />
		<rect x="218" y="64" width="76" height="76" rx="14" fill="#F6821F" />
	</svg>
);
