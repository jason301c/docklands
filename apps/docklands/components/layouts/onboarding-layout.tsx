import { LinkButton } from "@cloudflare/kumo/components/button";
import Link from "next/link";
import type React from "react";
import { Logo } from "@/components/shared/logo";
import { DOCS_URL, GITHUB_REPO_URL } from "@/shared/routes";
import { siteConfig } from "@/shared/site";

interface Props {
	children: React.ReactNode;
}

/**
 * Two-column auth shell: a form panel on the left (brand bar, vertically
 * centered form slot, footer) and a blank panel on the right reserved for
 * artwork. The right panel is intentionally empty for now and collapses below
 * `lg`, leaving the form panel full-width on small screens. Every onboarding
 * flow (login, register, invitation, reset) renders its content into the form
 * slot, so the shell is the single source of the brand bar and footer.
 */
export const OnboardingLayout = ({ children }: Props) => {
	const year = new Date().getFullYear();

	return (
		<div className="flex min-h-svh w-full bg-kumo-canvas">
			<div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
				<header className="flex items-center justify-between">
					<Link
						href="/"
						aria-label="Docklands home"
						className="flex items-center gap-2.5"
					>
						<Logo className="size-7" />
						<span className="font-semibold text-kumo-default text-lg tracking-tight">
							{siteConfig.name}
						</span>
					</Link>
					<LinkButton
						href={DOCS_URL}
						target="_blank"
						rel="noopener noreferrer"
						variant="ghost"
						size="sm"
					>
						Need help?
					</LinkButton>
				</header>

				<main className="flex flex-1 items-center justify-center py-12">
					<div className="w-full max-w-sm">{children}</div>
				</main>

				<footer className="flex items-center justify-between text-kumo-subtle text-sm">
					<span>
						© {year} {siteConfig.name}
					</span>
					<div className="flex items-center gap-6">
						<Link
							href={DOCS_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="transition-colors hover:text-kumo-default"
						>
							Docs
						</Link>
						<Link
							href={GITHUB_REPO_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="transition-colors hover:text-kumo-default"
						>
							GitHub
						</Link>
					</div>
				</footer>
			</div>

			<div className="hidden w-1/2 shrink-0 p-4 lg:block">
				<div className="relative h-full w-full overflow-hidden rounded-3xl border border-kumo-line bg-kumo-recessed">
					<img
						src="/auth-bg.webp"
						alt=""
						className="absolute inset-0 h-full w-full object-cover brightness-90"
					/>
					<div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
					<p className="absolute right-3 bottom-3 text-sm text-white/75 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
						Photo by{" "}
						<a
							href="https://unsplash.com/@harsilspatel?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
							target="_blank"
							rel="noopener noreferrer"
							className="underline-offset-2 hover:text-white hover:underline"
						>
							Harsil Patel
						</a>{" "}
						on{" "}
						<a
							href="https://unsplash.com/photos/melbourne-skyline-reflects-in-the-river-1uH3GuCEjSc?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
							target="_blank"
							rel="noopener noreferrer"
							className="underline-offset-2 hover:text-white hover:underline"
						>
							Unsplash
						</a>
					</p>
				</div>
			</div>
		</div>
	);
};
