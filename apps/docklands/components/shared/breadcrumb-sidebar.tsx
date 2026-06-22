import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { SidebarTrigger } from "@cloudflare/kumo/components/sidebar";
import { ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { api } from "@/client/api/trpc";
import { Separator } from "@/components/shared/separator";
import { TimeBadge } from "@/components/shared/time-badge";

interface BreadcrumbEntry {
	name: string;
	href?: string;
	dropdownItems?: {
		name: string;
		href: string;
	}[];
}

interface Props {
	list: BreadcrumbEntry[];
}

export const BreadcrumbSidebar = ({ list }: Props) => {
	const { data: isCloud } = api.settings.isCloud.useQuery();

	return (
		<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
			<div className="flex items-center justify-between w-full px-4">
				<div className="flex items-center gap-2">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<Breadcrumbs>
						{list.map((item, index) => (
							<Fragment key={`${item.name}-${index}`}>
								{item.dropdownItems && item.dropdownItems.length > 0 ? (
									<DropdownMenu>
										<DropdownMenu.Trigger className="flex items-center gap-1 hover:text-kumo-default transition-colors outline-none">
											{item.name}
											<ChevronDown className="h-4 w-4 opacity-50" />
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="start">
											{item.dropdownItems.map((subItem) => (
												<DropdownMenu.LinkItem
													key={subItem.href}
													href={subItem.href}
												>
													{subItem.name}
												</DropdownMenu.LinkItem>
											))}
										</DropdownMenu.Content>
									</DropdownMenu>
								) : item.href ? (
									<Breadcrumbs.Link href={item.href}>
										{item.name}
									</Breadcrumbs.Link>
								) : (
									<Breadcrumbs.Current>{item.name}</Breadcrumbs.Current>
								)}
								{index + 1 < list.length && <Breadcrumbs.Separator />}
							</Fragment>
						))}
					</Breadcrumbs>
				</div>
				{!isCloud && <TimeBadge />}
			</div>
		</header>
	);
};
