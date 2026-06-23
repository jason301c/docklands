import Image from "next/image";
import { siteConfig } from "@/lib/site";

const COLUMNS = [
	{
		heading: "Product",
		links: [
			{ label: "Features", href: "#features" },
			{ label: "Get started", href: "#get-started" },
			{ label: "Documentation", href: siteConfig.links.docs },
		],
	},
	{
		heading: "Project",
		links: [
			{ label: "GitHub", href: siteConfig.links.github },
			{
				label: "License (Apache-2.0)",
				href: `${siteConfig.links.github}/blob/canary/LICENSE.MD`,
			},
		],
	},
];

export function SiteFooter() {
	const year = new Date().getFullYear();

	return (
		<footer className="border-kumo-hairline border-t">
			<div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
				<div className="lg:col-span-2">
					<div className="flex items-center gap-2.5">
						<Image src="/docklands-logo.svg" alt="" width={24} height={24} />
						<span className="font-semibold text-kumo-strong tracking-tight">
							{siteConfig.name}
						</span>
					</div>
					<p className="mt-4 max-w-xs text-kumo-subtle text-sm leading-relaxed">
						{siteConfig.description}
					</p>
				</div>

				{COLUMNS.map((column) => (
					<div key={column.heading}>
						<h3 className="font-medium text-kumo-default text-sm">
							{column.heading}
						</h3>
						<ul className="mt-4 space-y-3">
							{column.links.map((link) => (
								<li key={link.label}>
									<a
										href={link.href}
										className="text-kumo-subtle text-sm transition-colors hover:text-kumo-default"
									>
										{link.label}
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>

			<div className="border-kumo-hairline border-t">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-6 text-kumo-subtle text-xs sm:flex-row sm:items-center sm:justify-between">
					<p>
						© {year} {siteConfig.name}. Apache-2.0 licensed.
					</p>
					<p>
						A community fork of{" "}
						<a
							href="https://github.com/dokploy/dokploy"
							className="underline underline-offset-2 transition-colors hover:text-kumo-default"
						>
							Dokploy
						</a>
						.
					</p>
				</div>
			</div>
		</footer>
	);
}
