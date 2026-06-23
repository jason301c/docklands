import { LinkButton } from "@cloudflare/kumo/components/button";
import { GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

const NAV = [
	{ label: "Features", href: "#features" },
	{ label: "Docs", href: siteConfig.links.docs },
	{ label: "GitHub", href: siteConfig.links.github },
];

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-50 border-kumo-hairline border-b bg-kumo-canvas/80 backdrop-blur-md">
			<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
				<Link href="/" className="flex items-center gap-2.5">
					<Image
						src="/docklands-logo-dark.svg"
						alt=""
						width={28}
						height={28}
						priority
					/>
					<span className="font-semibold text-kumo-strong text-lg tracking-tight">
						{siteConfig.name}
					</span>
				</Link>

				<nav className="hidden items-center gap-8 md:flex">
					{NAV.map((item) => (
						<a
							key={item.label}
							href={item.href}
							className="text-kumo-subtle text-sm transition-colors hover:text-kumo-default"
						>
							{item.label}
						</a>
					))}
				</nav>

				<div className="flex items-center gap-2">
					<LinkButton
						href={siteConfig.links.github}
						variant="ghost"
						size="sm"
						external
						icon={<GithubLogoIcon weight="fill" />}
						className="hidden sm:inline-flex"
					>
						Star
					</LinkButton>
					<LinkButton href="#get-started" variant="primary" size="sm">
						Get started
					</LinkButton>
				</div>
			</div>
		</header>
	);
}
