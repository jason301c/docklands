import { LinkButton } from "@cloudflare/kumo/components/button";
import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { siteConfig } from "@/lib/site";

export function Hero() {
	return (
		<section className="relative overflow-hidden">
			{/* Soft brand glow behind the hero */}
			<div
				aria-hidden
				className="-z-10 pointer-events-none absolute inset-x-0 top-[-10rem] mx-auto h-[24rem] max-w-4xl rounded-full bg-kumo-brand/10 blur-3xl"
			/>

			<div className="mx-auto flex w-full max-w-7xl flex-col items-center px-6 pt-24 pb-16 text-center sm:pt-32">
				<span className="mb-6 inline-flex items-center gap-2 rounded-full border border-kumo-hairline bg-kumo-fill px-3 py-1 font-medium text-kumo-subtle text-xs">
					<span className="size-1.5 rounded-full bg-kumo-brand" />
					Self-hosted · open source · your VM
				</span>

				<h1 className="max-w-3xl text-balance font-display font-semibold text-5xl text-kumo-strong leading-[1.05] tracking-tight sm:text-7xl">
					Deploy anything on infrastructure{" "}
					<span className="text-kumo-brand">you own</span>.
				</h1>

				<p className="mt-6 max-w-2xl text-pretty text-base text-kumo-subtle leading-relaxed sm:text-lg">
					Docklands is a self-hosted deployment control plane. Ship apps from
					Git, Docker images, and Compose; run managed databases, ingress,
					backups, and multi-machine runtime workers — without handing your data
					to anyone else.
				</p>

				<div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
					<LinkButton
						href="#get-started"
						variant="primary"
						size="lg"
						icon={<ArrowRightIcon weight="bold" />}
					>
						Get started
					</LinkButton>
					<LinkButton
						href={siteConfig.links.github}
						variant="secondary"
						size="lg"
						external
						icon={<GithubLogoIcon weight="fill" />}
					>
						View on GitHub
					</LinkButton>
				</div>
			</div>
		</section>
	);
}
