import { LinkButton } from "@cloudflare/kumo/components/button";
import { BookOpenIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { siteConfig } from "@/lib/site";

export function GetStarted() {
	return (
		<section id="get-started" className="scroll-mt-20 px-6 py-20">
			<div className="mx-auto max-w-3xl rounded-3xl border border-kumo-hairline bg-kumo-fill p-8 text-center sm:p-12">
				<h2 className="font-display font-semibold text-3xl text-kumo-strong tracking-tight sm:text-4xl">
					Up and running in minutes
				</h2>
				<p className="mt-4 text-kumo-subtle leading-relaxed">
					Point Docklands at any Linux VM with Docker installed. One command to
					bootstrap the control plane, then deploy from the dashboard.
				</p>

				<div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-xl border border-kumo-hairline bg-kumo-canvas px-4 py-3 text-left font-mono text-sm">
					<span className="select-none text-kumo-brand">$</span>
					<code className="overflow-x-auto text-kumo-default">
						{siteConfig.install}
					</code>
				</div>

				<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<LinkButton
						href={siteConfig.links.docs}
						variant="primary"
						size="lg"
						external
						icon={<BookOpenIcon weight="bold" />}
					>
						Read the install guide
					</LinkButton>
					<LinkButton
						href={siteConfig.links.github}
						variant="secondary"
						size="lg"
						external
						icon={<GithubLogoIcon weight="fill" />}
					>
						Browse the source
					</LinkButton>
				</div>
			</div>
		</section>
	);
}
