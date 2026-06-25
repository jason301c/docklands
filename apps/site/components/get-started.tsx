import { LinkButton } from "@cloudflare/kumo/components/button";
import { BookOpenIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { siteConfig } from "@/lib/site";

export function GetStarted() {
	return (
		<section id="get-started" className="scroll-mt-20 px-6 pb-28">
			{/* The signature gradient fills the whole panel; text and buttons go white.
			 * Buttons use the ghost variant so their colors aren't locked by Kumo's
			 * `!text-white` primary/secondary classes. The wrapper handles the
			 * scroll-reveal so it doesn't fight the card's gradient-pan animation. */}
			<div className="reveal-up mx-auto max-w-5xl">
				<div
					className="animate-gradient-pan rounded-3xl px-6 py-20 text-center sm:px-12"
					style={{
						// A dark overlay over the gradient takes the card a touch deeper.
						backgroundImage:
							"linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), var(--gradient-brand)",
					}}
				>
					<div className="mx-auto max-w-2xl">
						<h2 className="font-display font-semibold text-4xl text-white tracking-tight sm:text-5xl">
							Build it on your server.
						</h2>
						<p className="mt-5 text-pretty text-lg text-white/85 leading-relaxed">
							Follow the source install guide while Docklands is pre-release.
						</p>

						<div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
							<LinkButton
								href={siteConfig.links.docs}
								variant="ghost"
								size="lg"
								external
								className="bg-white text-kumo-inverse hover:bg-white/90"
								icon={<BookOpenIcon weight="bold" />}
							>
								Read the install guide
							</LinkButton>
							<LinkButton
								href={siteConfig.links.github}
								variant="ghost"
								size="lg"
								external
								className="text-white ring ring-white/40 hover:bg-white/10"
								icon={<GithubLogoIcon weight="fill" />}
							>
								View on GitHub
							</LinkButton>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
