import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The Docklands wordmark: stacked-container logo plus the name set in the
 * display serif. The site has no nav header, so this is the only persistent
 * brand anchor and home link, used in the hero and on the error pages.
 */
export function SiteBrand({ className }: { className?: string }) {
	return (
		<Link href="/" className={cn("flex items-center gap-2.5", className)}>
			<Image
				src="/docklands-logo-light.svg"
				alt=""
				width={28}
				height={28}
				priority
			/>
			<span className="font-display font-semibold text-kumo-strong text-xl tracking-tight">
				{siteConfig.name}
			</span>
		</Link>
	);
}
