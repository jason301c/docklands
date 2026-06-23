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
	Forward,
	GalleryVerticalEnd,
	GitBranch,
	House,
	KeyRound,
	type LucideIcon,
	Package,
	PieChart,
	Rocket,
	ScrollText,
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
			title: "Deployments",
			url: "/dashboard/deployments",
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
			title: "Ingress",
			url: "/dashboard/settings/ingress",
			icon: Activity,
			isEnabled: ({ permissions }) => !!permissions?.organization.update,
		},
		{
			isSingle: true,
			title: "Profile",
			url: "/dashboard/settings/profile",
			icon: User,
		},
		{
			isSingle: true,
			title: "Build Workers",
			url: "/dashboard/settings/build-workers",
			icon: Boxes,
			isEnabled: ({ permissions }) => !!permissions?.runtimeWorker.read,
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
			title: "Roles",
			icon: ShieldCheck,
			url: "/dashboard/settings/roles",
			isEnabled: ({ permissions }) => !!permissions?.member.read,
		},
		{
			isSingle: true,
			title: "Audit Log",
			icon: ScrollText,
			url: "/dashboard/settings/audit-log",
			isEnabled: ({ permissions }) => !!permissions?.auditLog.read,
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
			title: "Image Registry",
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
			title: "Cluster Nodes",
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
					title: "Runtime Workers",
					url: "/dashboard/settings/runtime",
					icon: Server,
					isEnabled: ({ permissions }) => !!permissions?.runtimeWorker.read,
				},
				{
					isSingle: true,
					title: "Container Runtime",
					url: "/dashboard/container-runtime",
					icon: BlocksIcon,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					isSingle: true,
					title: "Cluster Runtime",
					url: "/dashboard/cluster-runtime",
					icon: PieChart,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					isSingle: true,
					title: "Ingress Requests",
					url: "/dashboard/requests",
					icon: Forward,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
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
					title: "Host Metrics",
					url: "/dashboard/host-metrics",
					icon: BarChartHorizontalBigIcon,
					isEnabled: ({ permissions }) => !!permissions?.monitoring.read,
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
}): Menu {
	const enabledOpts = {
		auth: opts.auth,
		permissions: opts.permissions,
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
	const normalizedItemUrl = opts.itemUrl;
	const normalizedPathname = opts.pathname;

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
