import { LinkButton } from "@cloudflare/kumo/components/button";
import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { RotatingWord } from "@/components/rotating-word";
import { SiteBrand } from "@/components/site-brand";
import { siteConfig } from "@/lib/site";

// Warm gold for the GitHub star, a deliberate single warm note against the iris.
const GOLD = "#e3b341";

export function Hero() {
	return (
		<section
			className="relative overflow-hidden"
			style={{
				background:
					"linear-gradient(to bottom, var(--surface-brand), var(--color-kumo-canvas))",
			}}
		>
			{/* Full-width top bar: brand left, actions right (replaces the site header) */}
			<div className="relative flex w-full items-center justify-between px-6 pt-6 sm:px-8">
				<SiteBrand />

				<div className="flex items-center gap-2.5">
					<LinkButton
						href={siteConfig.links.github}
						variant="secondary"
						size="base"
						external
						className="h-9 px-3.5"
						icon={<StarIcon weight="fill" color={GOLD} />}
					>
						Star on GitHub
					</LinkButton>
					<LinkButton
						href={siteConfig.links.docs}
						variant="primary"
						size="base"
						external
						className="h-9 px-3.5"
					>
						Get started
					</LinkButton>
				</div>
			</div>

			<div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-28 pb-24 text-center sm:pt-36">
				<h1 className="font-display font-semibold text-5xl text-kumo-strong leading-[1.02] tracking-tight sm:text-7xl">
					Self host your apps on
					<RotatingWord />
				</h1>

				<p className="mt-8 max-w-md text-pretty text-kumo-default text-lg leading-relaxed sm:text-xl">
					A deployment control plane for the server you already own.
				</p>

				<div className="mt-10 flex justify-center">
					<LinkButton
						href="#get-started"
						variant="primary"
						size="lg"
						className="h-13 px-9 font-medium text-lg"
					>
						Get started
					</LinkButton>
				</div>
			</div>
		</section>
	);
}
