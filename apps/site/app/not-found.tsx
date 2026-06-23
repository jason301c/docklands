import { LinkButton } from "@cloudflare/kumo/components/button";
import { BookOpenIcon, HouseIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ErrorState } from "@/components/error-state";
import { SiteBrand } from "@/components/site-brand";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
	title: "404 - Nothing docked here",
};

export default function NotFound() {
	return (
		<>
			<div className="mx-auto w-full max-w-7xl px-6 pt-6">
				<SiteBrand />
			</div>
			<main className="flex flex-1 flex-col">
				<ErrorState
					code="404"
					headline="This one wandered up a tree."
					message="There's nothing moored at this URL. If you've ever been to Docklands, you know cows end up in strange places - let's get you back to dry land."
				>
					<LinkButton
						href="/"
						variant="primary"
						size="lg"
						icon={<HouseIcon weight="bold" />}
					>
						Back to home
					</LinkButton>
					<LinkButton
						href={siteConfig.links.docs}
						variant="secondary"
						size="lg"
						external
						icon={<BookOpenIcon weight="bold" />}
					>
						Read the docs
					</LinkButton>
				</ErrorState>
			</main>
			<SiteFooter />
		</>
	);
}
