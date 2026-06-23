import type { Metadata } from "next";
import { ColorsPreview } from "./_client";

// Internal design-reference page: a kitchen-sink of the site's color tokens and
// Kumo components. Intentionally unlinked and kept out of search indexes.
export const metadata: Metadata = {
	title: "Colors & components preview",
	robots: { index: false, follow: false },
};

export default function ColorsPreviewPage() {
	return <ColorsPreview />;
}
