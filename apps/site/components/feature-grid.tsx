import type { Icon } from "@phosphor-icons/react";
import {
	ArchiveIcon,
	DatabaseIcon,
	GitBranchIcon,
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
			"Ship from Git, prebuilt Docker images, or full Docker Compose stacks. Buildpacks, Dockerfiles, and Nixpacks all work out of the box.",
	},
	{
		icon: DatabaseIcon,
		title: "Managed databases",
		description:
			"Provision Postgres, MySQL, MariaDB, MongoDB, Redis, and libSQL as first-class services, with generated connection variables wired into your apps.",
	},
	{
		icon: GlobeHemisphereWestIcon,
		title: "Ingress & TLS",
		description:
			"Route traffic through the built-in ingress runtime with automatic certificates and per-service domains — Traefik under the hood, no YAML to babysit.",
	},
	{
		icon: ArchiveIcon,
		title: "Backups you control",
		description:
			"Schedule database and volume backups to your own destinations. Your data never leaves infrastructure you own.",
	},
	{
		icon: HardDrivesIcon,
		title: "Multi-machine workers",
		description:
			"Add remote runtime workers over SSH to build and run containers across several machines from one control plane.",
	},
	{
		icon: ShieldCheckIcon,
		title: "Self-hosted by design",
		description:
			"One organization per instance, your VM, your Docker engine, your secrets. No hosted dependency, no phone-home, Apache-2.0 licensed.",
	},
];

export function FeatureGrid() {
	return (
		<section
			id="features"
			className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-20"
		>
			<div className="mx-auto max-w-2xl text-center">
				<h2 className="font-display font-semibold text-3xl text-kumo-strong tracking-tight sm:text-4xl">
					Everything to run your own platform
				</h2>
				<p className="mt-4 text-kumo-subtle leading-relaxed">
					The deployment surface of a managed PaaS, on hardware you control.
				</p>
			</div>

			<div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-kumo-hairline bg-kumo-hairline sm:grid-cols-2 lg:grid-cols-3">
				{FEATURES.map((feature) => {
					const Glyph = feature.icon;
					return (
						<div
							key={feature.title}
							className="flex flex-col gap-4 bg-kumo-canvas p-7 transition-colors hover:bg-kumo-fill"
						>
							<span className="flex size-10 items-center justify-center rounded-lg bg-kumo-brand/10 text-kumo-brand">
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
