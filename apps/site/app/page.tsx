import { FeatureGrid } from "@/components/feature-grid";
import { GetStarted } from "@/components/get-started";
import { Hero } from "@/components/hero";
import { ScreenshotGallery } from "@/components/screenshot-gallery";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
	return (
		<>
			<main className="flex-1">
				<Hero />
				<ScreenshotGallery />
				<FeatureGrid />
				<GetStarted />
			</main>
			<SiteFooter />
		</>
	);
}
