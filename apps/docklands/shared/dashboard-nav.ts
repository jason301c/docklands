import type { inferRouterOutputs } from "@trpc/server";
import {
	Activity,
	BarChartHorizontalBigIcon,
	Bell,
	BlocksIcon,
	BookIcon,
	Boxes,
	CircleHelp,
	Clock,
	Database,
	Folder,
	Forward,
	GalleryVerticalEnd,
	GitBranch,
	House,
	KeyRound,
	type LucideIcon,
	Package,
	PieChart,
	Rocket,
	Server,
	ShieldCheck,
	Tags,
	User,
	Users,
} from "lucide-react";
import type { ComponentType } from "react";
import type { AppRouter } from "@/server/api/root";

export type AuthQueryOutput = inferRouterOutputs<AppRouter>["user"]["get"];
export type PermissionsOutput =
	inferRouterOutputs<AppRouter>["user"]["getPermissions"];

type EnabledOpts = {
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	isCloud: boolean;
};

export type SingleNavItem = {
	isSingle?: true;
	title: string;
	url: string;
	icon?: LucideIcon;
	isEnabled?: (opts: EnabledOpts) => boolean;
};

export type NavItem =
	| SingleNavItem
	| {
			isSingle: false;
			title: string;
			icon: LucideIcon;
			items: SingleNavItem[];
			isEnabled?: (opts: EnabledOpts) => boolean;
	  };

export type ExternalLink = {
	name: string;
	url: string;
	icon: ComponentType<{ className?: string }>;
	isEnabled?: (opts: EnabledOpts) => boolean;
};

export type Menu = {
	home: NavItem[];
	settings: NavItem[];
	help: ExternalLink[];
};

export const DASHBOARD_MENU: Menu = {
	home: [
		{
			isSingle: true,
			title: "Canvas",
			url: "/dashboard/workspace",
			icon: House,
		},
		{
			isSingle: true,
			title: "Projects",
			url: "/dashboard/projects",
			icon: Folder,
		},
		{
			isSingle: true,
			title: "Deployments",
			url: "/dashboard/builds",
			icon: Rocket,
			isEnabled: ({ permissions }) => !!permissions?.deployment.read,
		},
		{
			isSingle: true,
			title: "Automations",
			url: "/dashboard/automations",
			icon: Clock,
			isEnabled: ({ permissions }) => !!permissions?.organization.update,
		},
	],

	settings: [
		{
			isSingle: true,
			title: "Networking",
			url: "/dashboard/settings/ingress",
			icon: Activity,
			isEnabled: ({ permissions, isCloud }) =>
				!!(permissions?.organization.update && !isCloud),
		},
		{
			isSingle: true,
			title: "Profile",
			url: "/dashboard/settings/profile",
			icon: User,
		},
		{
			isSingle: true,
			title: "Builders",
			url: "/dashboard/settings/build-workers",
			icon: Boxes,
			isEnabled: ({ permissions, isCloud }) =>
				!!(permissions?.server.read && !isCloud),
		},
		{
			isSingle: true,
			title: "Users",
			icon: Users,
			url: "/dashboard/settings/users",
			isEnabled: ({ permissions }) => !!permissions?.member.read,
		},
		{
			isSingle: true,
			title: "SSH Keys",
			icon: KeyRound,
			url: "/dashboard/settings/ssh-keys",
			isEnabled: ({ permissions }) => !!permissions?.sshKeys.read,
		},
		{
			isSingle: true,
			title: "Tags",
			url: "/dashboard/settings/tags",
			icon: Tags,
			isEnabled: ({ permissions }) => !!permissions?.tag.read,
		},
		{
			isSingle: true,
			title: "Git Providers",
			url: "/dashboard/settings/git-providers",
			icon: GitBranch,
			isEnabled: ({ permissions }) => !!permissions?.gitProviders.read,
		},
		{
			isSingle: true,
			title: "Registry",
			url: "/dashboard/settings/image-registry",
			icon: Package,
			isEnabled: ({ permissions }) => !!permissions?.registry.read,
		},
		{
			isSingle: true,
			title: "Storage",
			url: "/dashboard/settings/storage",
			icon: Database,
			isEnabled: ({ permissions }) => !!permissions?.destination.read,
		},
		{
			isSingle: true,
			title: "Certificates",
			url: "/dashboard/settings/certificates",
			icon: ShieldCheck,
			isEnabled: ({ permissions }) => !!permissions?.certificate.read,
		},
		{
			isSingle: true,
			title: "Nodes",
			url: "/dashboard/settings/cluster-nodes",
			icon: Boxes,
			isEnabled: ({ permissions }) => !!permissions?.organization.update,
		},
		{
			isSingle: true,
			title: "Notifications",
			url: "/dashboard/settings/notifications",
			icon: Bell,
			isEnabled: ({ permissions }) => !!permissions?.notification.read,
		},
		{
			isSingle: false,
			title: "Runtime",
			icon: BlocksIcon,
			items: [
				{
					isSingle: true,
					title: "Capacity",
					url: "/dashboard/settings/runtime",
					icon: Server,
					isEnabled: ({ permissions }) => !!permissions?.server.read,
				},
				{
					isSingle: true,
					title: "Containers",
					url: "/dashboard/container-runtime",
					icon: BlocksIcon,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					isSingle: true,
					title: "Cluster",
					url: "/dashboard/cluster-runtime",
					icon: PieChart,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					isSingle: true,
					title: "Proxy Requests",
					url: "/dashboard/requests",
					icon: Forward,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.docker.read && !isCloud),
				},
				{
					isSingle: true,
					title: "Ingress Files",
					url: "/dashboard/proxy-files",
					icon: GalleryVerticalEnd,
					isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
				},
				{
					isSingle: true,
					title: "Metrics",
					url: "/dashboard/host-metrics",
					icon: BarChartHorizontalBigIcon,
					isEnabled: ({ isCloud, permissions }) =>
						!isCloud && !!permissions?.monitoring.read,
				},
			],
		},
	],

	help: [
		{
			name: "Documentation",
			url: "https://github.com/jason301c/docklands",
			icon: BookIcon,
		},
		{
			name: "Support",
			url: "https://discord.gg/2tBnJ3jDJc",
			icon: CircleHelp,
		},
	],
};

export function createMenuForAuthUser(opts: {
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	isCloud: boolean;
}): Menu {
	const enabledOpts = {
		auth: opts.auth,
		permissions: opts.permissions,
		isCloud: opts.isCloud,
	};
	const isEnabled = (item: { isEnabled?: (o: EnabledOpts) => boolean }) =>
		!item.isEnabled || item.isEnabled(enabledOpts);
	const filterEnabled = <
		T extends {
			isEnabled?: (o: EnabledOpts) => boolean;
		},
	>(
		items: T[],
	): T[] => items.filter(isEnabled);
	const filterNavItems = (items: NavItem[]): NavItem[] =>
		items.reduce<NavItem[]>((filtered, item) => {
			if (!isEnabled(item)) return filtered;

			if (item.isSingle === false) {
				const nestedItems = filterEnabled(item.items);
				if (nestedItems.length === 0) return filtered;
				filtered.push({ ...item, items: nestedItems });
				return filtered;
			}

			filtered.push(item);
			return filtered;
		}, []);

	return {
		home: filterNavItems(DASHBOARD_MENU.home),
		settings: filterNavItems(DASHBOARD_MENU.settings),
		help: filterEnabled(DASHBOARD_MENU.help),
	};
}

export function isActiveRoute(opts: {
	itemUrl: string;
	pathname: string;
}): boolean {
	const normalizedItemUrl = opts.itemUrl?.replace("/projects", "/project");
	const normalizedPathname = opts.pathname?.replace("/projects", "/project");

	if (!normalizedPathname) return false;

	if (normalizedPathname === normalizedItemUrl) return true;

	if (normalizedPathname.startsWith(normalizedItemUrl)) {
		const nextChar = normalizedPathname.charAt(normalizedItemUrl.length);
		return nextChar === "/";
	}

	return false;
}

export function findActiveNavItem(
	navItems: NavItem[],
	pathname: string,
): SingleNavItem | undefined {
	const found = navItems.find((item) =>
		item.isSingle !== false
			? isActiveRoute({ itemUrl: item.url, pathname })
			: item.items.some((item) =>
					isActiveRoute({ itemUrl: item.url, pathname }),
				),
	);

	if (found?.isSingle !== false) {
		return found;
	}

	return found?.items.find((item) =>
		isActiveRoute({ itemUrl: item.url, pathname }),
	);
}
