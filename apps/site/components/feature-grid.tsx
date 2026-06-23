import type { Icon } from "@phosphor-icons/react";
import {
	ArchiveIcon,
	DatabaseIcon,
	GaugeIcon,
	GitBranchIcon,
	GitPullRequestIcon,
	GlobeHemisphereWestIcon,
	HardDrivesIcon,
	ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";

type Feature = {
	icon: Icon;
	title: string;
	description: string;
};

const FEATURES: Feature[] = [
	{
		icon: GitBranchIcon,
		title: "Deploy from anywhere",
		description:
			"Ship from Git, prebuilt images, or full Compose stacks. Dockerfiles, buildpacks, and Nixpacks all work.",
	},
	{
		icon: DatabaseIcon,
		title: "Managed databases",
		description:
			"Postgres, MySQL, MariaDB, MongoDB, Redis, and libSQL as first-class services, with connection variables wired in.",
	},
	{
		icon: GlobeHemisphereWestIcon,
		title: "Ingress and TLS",
		description:
			"Per-service domains with automatic certificates. Traefik runs under the hood, with no YAML to babysit.",
	},
	{
		icon: ArchiveIcon,
		title: "Backups you control",
		description:
			"Schedule database and volume backups to your own destinations. Your data stays on storage you own.",
	},
	{
		icon: HardDrivesIcon,
		title: "Many machines, one plane",
		description:
			"Add remote runtime workers over SSH and build across several machines from a single control plane.",
	},
	{
		icon: ShieldCheckIcon,
		title: "Self-hosted by design",
		description:
			"Your VM, your Docker engine, your secrets. No hosted dependency, no phone-home, no seat pricing.",
	},
	{
		icon: GaugeIcon,
		title: "Logs and metrics",
		description:
			"Stream live logs and watch CPU, memory, and disk for every service from one dashboard.",
	},
	{
		icon: GitPullRequestIcon,
		title: "Preview environments",
		description:
			"Every pull request gets its own deployment and URL, torn down again when you merge.",
	},
];

export function FeatureGrid() {
	return (
		<section
			id="features"
			className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-24"
		>
			<div className="max-w-2xl">
				<h2 className="font-display font-semibold text-3xl text-kumo-strong tracking-tight sm:text-4xl">
					Everything a deploy needs
				</h2>
				<p className="mt-4 text-kumo-subtle text-lg leading-relaxed">
					The deployment surface of a managed platform, on hardware you control.
				</p>
			</div>

			<div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-kumo-hairline bg-kumo-hairline sm:grid-cols-2 lg:grid-cols-4">
				{FEATURES.map((feature) => {
					const Glyph = feature.icon;
					return (
						<div
							key={feature.title}
							className="group flex flex-col gap-4 bg-kumo-canvas p-8 transition-colors hover:bg-kumo-base"
						>
							<span className="flex size-11 items-center justify-center rounded-xl bg-kumo-brand/10 text-kumo-brand transition-colors group-hover:bg-kumo-brand/20">
								<Glyph size={22} weight="duotone" />
							</span>
							<h3 className="font-medium text-kumo-strong text-lg">
								{feature.title}
							</h3>
							<p className="text-kumo-subtle text-sm leading-relaxed">
								{feature.description}
							</p>
						</div>
					);
				})}
			</div>
		</section>
	);
}
