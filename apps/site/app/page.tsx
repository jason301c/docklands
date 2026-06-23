import { FeatureGrid } from "@/components/feature-grid";
import { GetStarted } from "@/components/get-started";
import { Hero } from "@/components/hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
	return (
		<>
			<SiteHeader />
			<main className="flex-1">
				<Hero />
				<FeatureGrid />
				<GetStarted />
			</main>
			<SiteFooter />
		</>
	);
}
