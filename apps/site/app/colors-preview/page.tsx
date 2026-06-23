import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import type { Metadata } from "next";

// Internal design-reference page. Intentionally NOT linked from anywhere and
// kept out of search indexes — it's a kitchen-sink of every Kumo color token
// plus mock components, used to eyeball the site's palette in one place.
export const metadata: Metadata = {
	title: "Colors & components preview",
	robots: { index: false, follow: false },
};

/** A single background-color token, rendered as a swatch + its CSS variable. */
function Swatch({ name }: { name: string }) {
	const cssVar = `var(--color-kumo-${name})`;
	return (
		<div className="flex flex-col gap-1.5">
			<div
				className="h-16 w-full rounded-lg border border-kumo-hairline"
				style={{ background: cssVar }}
			/>
			<div className="px-0.5">
				<p className="font-medium text-kumo-strong text-xs">{name}</p>
				<p className="font-mono text-[10px] text-kumo-subtle">
					--color-kumo-{name}
				</p>
			</div>
		</div>
	);
}

function SwatchGroup({ title, names }: { title: string; names: string[] }) {
	return (
		<section className="mt-12">
			<h2 className="font-display font-semibold text-2xl text-kumo-strong tracking-tight">
				{title}
			</h2>
			<div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
				{names.map((name) => (
					<Swatch key={name} name={name} />
				))}
			</div>
		</section>
	);
}

const TEXT_TOKENS = [
	"default",
	"strong",
	"subtle",
	"inactive",
	"placeholder",
	"link",
	"info",
	"success",
	"danger",
	"warning",
	"brand",
];

export default function ColorsPreviewPage() {
	return (
		<main className="mx-auto w-full max-w-6xl px-6 py-16">
			<header className="border-kumo-hairline border-b pb-8">
				<p className="font-medium font-mono text-kumo-subtle text-xs tracking-widest">
					INTERNAL · /colors-preview
				</p>
				<h1 className="mt-3 font-display font-semibold text-5xl text-kumo-strong tracking-tight">
					Colors &amp; components
				</h1>
				<p className="mt-4 max-w-2xl text-kumo-subtle leading-relaxed">
					Every Kumo color token the site can use, plus mock components. The
					marketing site is light-only, so these are the resolved light values.
					Not linked from anywhere and excluded from search indexes.
				</p>
			</header>

			<SwatchGroup
				title="Brand & focus"
				names={["brand", "brand-hover", "focus", "line"]}
			/>
			<SwatchGroup
				title="Surfaces"
				names={[
					"canvas",
					"base",
					"elevated",
					"recessed",
					"overlay",
					"control",
					"tint",
					"contrast",
				]}
			/>
			<SwatchGroup
				title="Fills & lines"
				names={["fill", "fill-hover", "interact", "hairline"]}
			/>
			<SwatchGroup
				title="Status"
				names={[
					"success",
					"success-tint",
					"info",
					"info-tint",
					"warning",
					"warning-tint",
					"danger",
					"danger-tint",
				]}
			/>
			<SwatchGroup
				title="Banners"
				names={["banner-info", "banner-warning"]}
			/>
			<SwatchGroup
				title="Badges"
				names={[
					"badge-red",
					"badge-orange",
					"badge-purple",
					"badge-teal",
					"badge-blue",
					"badge-neutral",
					"badge-inverted",
				]}
			/>

			{/* Text colors */}
			<section className="mt-12">
				<h2 className="font-display font-semibold text-2xl text-kumo-strong tracking-tight">
					Text colors
				</h2>
				<div className="mt-5 grid gap-3 rounded-xl border border-kumo-hairline bg-kumo-base p-6 sm:grid-cols-2">
					{TEXT_TOKENS.map((token) => (
						<div key={token} className="flex items-baseline gap-3">
							<span
								className="text-lg"
								style={{ color: `var(--text-color-kumo-${token})` }}
							>
								The quick brown fox
							</span>
							<span className="font-mono text-[10px] text-kumo-subtle">
								text-kumo-{token}
							</span>
						</div>
					))}
					{/* `inverse` needs a dark backing to be visible */}
					<div className="flex items-center gap-3 rounded-md bg-kumo-contrast px-3 py-1">
						<span
							className="text-lg"
							style={{ color: "var(--text-color-kumo-inverse)" }}
						>
							The quick brown fox
						</span>
						<span className="font-mono text-[10px] text-kumo-subtle">
							text-kumo-inverse
						</span>
					</div>
				</div>
			</section>

			{/* Typography */}
			<section className="mt-12">
				<h2 className="font-display font-semibold text-2xl text-kumo-strong tracking-tight">
					Typography
				</h2>
				<div className="mt-5 space-y-6 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
					<div>
						<p className="font-mono text-[10px] text-kumo-subtle">
							font-display — Fraunces
						</p>
						<p className="font-display font-semibold text-4xl text-kumo-strong tracking-tight">
							Deploy anything on infrastructure you own.
						</p>
					</div>
					<div>
						<p className="font-mono text-[10px] text-kumo-subtle">
							font-sans — Inter
						</p>
						<p className="text-base text-kumo-default leading-relaxed">
							Docklands is a self-hosted deployment control plane. The quick
							brown fox jumps over the lazy dog. 0123456789
						</p>
					</div>
				</div>
			</section>

			{/* Buttons */}
			<section className="mt-12">
				<h2 className="font-display font-semibold text-2xl text-kumo-strong tracking-tight">
					Buttons
				</h2>
				<div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
					<Button variant="primary">Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="destructive">Destructive</Button>
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
					<Button variant="primary" size="sm">
						Small
					</Button>
					<Button variant="primary" size="base">
						Base
					</Button>
					<Button variant="primary" size="lg">
						Large
					</Button>
					<Button variant="primary" loading>
						Loading
					</Button>
					<Button variant="primary" disabled>
						Disabled
					</Button>
				</div>
			</section>

			{/* Badges */}
			<section className="mt-12">
				<h2 className="font-display font-semibold text-2xl text-kumo-strong tracking-tight">
					Badges
				</h2>
				<div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
					<Badge variant="primary">Primary</Badge>
					<Badge variant="secondary">Secondary</Badge>
					<Badge variant="success">Success</Badge>
					<Badge variant="warning">Warning</Badge>
					<Badge variant="error">Error</Badge>
					<Badge variant="info">Info</Badge>
					<Badge variant="beta">Beta</Badge>
					<Badge variant="outline">Outline</Badge>
				</div>
			</section>

			{/* Cards & banners */}
			<section className="mt-12 mb-8">
				<h2 className="font-display font-semibold text-2xl text-kumo-strong tracking-tight">
					Surfaces in context
				</h2>
				<div className="mt-5 grid gap-4 md:grid-cols-2">
					{/* Card */}
					<div className="rounded-xl border border-kumo-hairline bg-kumo-base p-6 shadow-sm">
						<h3 className="font-display font-semibold text-kumo-strong text-lg tracking-tight">
							A card on bg-kumo-base
						</h3>
						<p className="mt-2 text-kumo-subtle text-sm leading-relaxed">
							Body copy in text-kumo-subtle. Cards sit on the elevated/base
							surface above the canvas, separated by a hairline border.
						</p>
						<div className="mt-4 flex items-center gap-2">
							<Button variant="primary" size="sm">
								Confirm
							</Button>
							<Button variant="ghost" size="sm">
								Cancel
							</Button>
						</div>
					</div>

					{/* Input + banners */}
					<div className="flex flex-col gap-4">
						<div className="rounded-xl border border-kumo-hairline bg-kumo-base p-6">
							<label
								htmlFor="preview-input"
								className="font-medium text-kumo-strong text-sm"
							>
								Email
							</label>
							<input
								id="preview-input"
								type="email"
								placeholder="you@example.com"
								className="mt-2 w-full rounded-lg border border-kumo-hairline bg-kumo-control px-3 py-2 text-kumo-default text-sm outline-none placeholder:text-kumo-placeholder focus:border-kumo-brand"
							/>
						</div>
						<div className="rounded-lg border border-kumo-hairline bg-kumo-banner-info px-4 py-3 text-kumo-default text-sm">
							ℹ️ This is an informational banner (bg-kumo-banner-info).
						</div>
						<div className="rounded-lg border border-kumo-hairline bg-kumo-banner-warning px-4 py-3 text-kumo-default text-sm">
							⚠️ This is a warning banner (bg-kumo-banner-warning).
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
