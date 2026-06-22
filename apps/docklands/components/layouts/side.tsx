"use client";
import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { Button } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "@cloudflare/kumo/components/sidebar";
import type { inferRouterOutputs } from "@trpc/server";
import {
	Activity,
	BarChartHorizontalBigIcon,
	Bell,
	BlocksIcon,
	BookIcon,
	Boxes,
	ChevronRight,
	ChevronsUpDown,
	CircleHelp,
	Clock,
	Database,
	Folder,
	Forward,
	GalleryVerticalEnd,
	GitBranch,
	House,
	KeyRound,
	Loader2,
	type LucideIcon,
	Package,
	PieChart,
	Rocket,
	Server,
	ShieldCheck,
	Star,
	Tags,
	Trash2,
	User,
	Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import { Separator } from "@/components/shared/separator";
import { TimeBadge } from "@/components/shared/time-badge";
import { toast } from "@/components/shared/toast";
import type { AppRouter } from "@/server/api/root";
import { cn } from "@/shared/utils";
import { AddOrganization } from "../dashboard/organization/handle-organization";
import { DialogAction } from "../shared/dialog-action";
import { Logo } from "../shared/logo";
import { UpdateServerButton } from "./update-server";
import { UserNav } from "./user-nav";

// The types of the queries we are going to use
type AuthQueryOutput = inferRouterOutputs<AppRouter>["user"]["get"];
type PermissionsOutput =
	inferRouterOutputs<AppRouter>["user"]["getPermissions"];

const SIDEBAR_COOKIE_NAME = "sidebar_state";

type EnabledOpts = {
	auth?: AuthQueryOutput;
	permissions?: PermissionsOutput;
	isCloud: boolean;
};

type SingleNavItem = {
	isSingle?: true;
	title: string;
	url: string;
	icon?: LucideIcon;
	isEnabled?: (opts: EnabledOpts) => boolean;
};

// NavItem type
// Consists of a single item or a group of items
// If `isSingle` is true or undefined, the item is a single item
// If `isSingle` is false, the item is a group of items
type NavItem =
	| SingleNavItem
	| {
			isSingle: false;
			title: string;
			icon: LucideIcon;
			items: SingleNavItem[];
			isEnabled?: (opts: EnabledOpts) => boolean;
	  };

// ExternalLink type
// Represents an external link item (used for the help section)
type ExternalLink = {
	name: string;
	url: string;
	icon: React.ComponentType<{ className?: string }>;
	isEnabled?: (opts: EnabledOpts) => boolean;
};

// Menu type
// Consists of home, settings, and help items
type Menu = {
	home: NavItem[];
	settings: NavItem[];
	help: ExternalLink[];
};

// Menu items
// Consists of unfiltered home, settings, and help items
// The items are filtered based on the user's role and permissions
// The `isEnabled` function is called to determine if the item should be displayed
const MENU: Menu = {
	home: [
		{
			isSingle: true,
			title: "Workspace",
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
			title: "Builds",
			url: "/dashboard/deployments",
			icon: Rocket,
			isEnabled: ({ permissions }) => !!permissions?.deployment.read,
		},
		{
			isSingle: true,
			title: "Automations",
			url: "/dashboard/schedules",
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
			// Only enabled for admins in non-cloud environments
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
			title: "Build Workers",
			url: "/dashboard/settings/deployments",
			icon: Boxes,
			isEnabled: ({ permissions, isCloud }) =>
				!!(permissions?.server.read && !isCloud),
		},
		{
			isSingle: true,
			title: "Users",
			icon: Users,
			url: "/dashboard/settings/users",
			// Only enabled for users with member.read permission
			isEnabled: ({ permissions }) => !!permissions?.member.read,
		},
		{
			isSingle: true,
			title: "SSH Keys",
			icon: KeyRound,
			url: "/dashboard/settings/ssh-keys",
			// Only enabled for users with access to SSH keys
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
			// Only enabled for users with access to Git providers
			isEnabled: ({ permissions }) => !!permissions?.gitProviders.read,
		},
		{
			isSingle: true,
			title: "Image Registry",
			url: "/dashboard/settings/registry",
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
			title: "Cluster",
			url: "/dashboard/settings/cluster",
			icon: Boxes,
			// Only enabled for admins
			isEnabled: ({ permissions }) => !!permissions?.organization.update,
		},
		{
			isSingle: true,
			title: "Notifications",
			url: "/dashboard/settings/notifications",
			icon: Bell,
			// Only enabled for users with access to notifications
			isEnabled: ({ permissions }) => !!permissions?.notification.read,
		},
		{
			isSingle: false,
			title: "Infrastructure",
			icon: BlocksIcon,
			items: [
				{
					isSingle: true,
					title: "Runtime Capacity",
					url: "/dashboard/settings/runtime",
					icon: Server,
					isEnabled: ({ permissions }) => !!permissions?.server.read,
				},
				{
					isSingle: true,
					title: "Container Runtime",
					url: "/dashboard/runtime",
					icon: BlocksIcon,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					isSingle: true,
					title: "Cluster Runtime",
					url: "/dashboard/orchestration",
					icon: PieChart,
					isEnabled: ({ permissions }) => !!permissions?.docker.read,
				},
				{
					isSingle: true,
					title: "Requests",
					url: "/dashboard/requests",
					icon: Forward,
					isEnabled: ({ permissions, isCloud }) =>
						!!(permissions?.docker.read && !isCloud),
				},
				{
					isSingle: true,
					title: "Proxy Files",
					url: "/dashboard/ingress",
					icon: GalleryVerticalEnd,
					isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
				},
				{
					isSingle: true,
					title: "Host Metrics",
					url: "/dashboard/monitoring",
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
} as const;

/**
 * Creates a menu based on the current user's role and permissions
 * @returns a menu object with the home, settings, and help items
 */
function createMenuForAuthUser(opts: {
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
		items: readonly T[],
	): T[] => items.filter(isEnabled) as T[];
	const filterNavItems = (items: readonly NavItem[]): NavItem[] =>
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
		home: filterNavItems(MENU.home),
		settings: filterNavItems(MENU.settings),
		help: filterEnabled(MENU.help),
	};
}

/**
 * Determines if an item url is active based on the current pathname
 * @returns true if the item url is active, false otherwise
 */
function isActiveRoute(opts: {
	/** The url of the item. Usually obtained from `item.url` */
	itemUrl: string;
	/** The current pathname. Usually obtained from `usePathname()` */
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

/**
 * Finds the active nav item based on the current pathname
 * @returns the active nav item with `SingleNavItem` type or undefined if none is active
 */
function findActiveNavItem(
	navItems: NavItem[],
	pathname: string,
): SingleNavItem | undefined {
	const found = navItems.find((item) =>
		item.isSingle !== false
			? // The current item is single, so check if the item url is active
				isActiveRoute({ itemUrl: item.url, pathname })
			: // The current item is not single, so check if any of the sub items are active
				item.items.some((item) =>
					isActiveRoute({ itemUrl: item.url, pathname }),
				),
	);

	if (found?.isSingle !== false) {
		// The found item is single, so return it
		return found;
	}

	// The found item is not single, so find the active sub item
	return found?.items.find((item) =>
		isActiveRoute({ itemUrl: item.url, pathname }),
	);
}

interface Props {
	children: React.ReactNode;
}

function LogoWrapper() {
	return <SidebarLogo />;
}

function SidebarLogo() {
	const { state } = useSidebar();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: user } = api.user.get.useQuery();
	const { data: session } = api.user.session.useQuery();
	const {
		data: organizations,
		refetch,
		isLoading,
	} = api.organization.all.useQuery();
	const { mutateAsync: deleteOrganization, isPending: isRemoving } =
		api.organization.delete.useMutation();
	const { mutateAsync: setDefaultOrganization, isPending: isSettingDefault } =
		api.organization.setDefault.useMutation();
	const { isMobile } = useSidebar();
	const isCollapsed = state === "collapsed" && !isMobile;
	const { data: activeOrganization } = api.organization.active.useQuery();

	const { data: invitations, refetch: refetchInvitations } =
		api.user.getInvitations.useQuery();

	const [_activeTeam, setActiveTeam] = useState<
		typeof activeOrganization | null
	>(null);

	useEffect(() => {
		if (activeOrganization) {
			setActiveTeam(activeOrganization);
		}
	}, [activeOrganization]);

	return (
		<>
			{isLoading ? (
				<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[5vh] pt-4">
					<Loader2 className="animate-spin size-4" />
				</div>
			) : (
				<SidebarMenu
					className={cn(
						"flex gap-2",
						isCollapsed ? "flex-col" : "flex-row justify-between items-center",
					)}
				>
					{/* Organization Logo and Selector */}
					<SidebarMenuItem className={"w-full"}>
						<DropdownMenu>
							<DropdownMenu.Trigger
								render={
									<SidebarMenuButton
										size={isCollapsed ? "sm" : "base"}
										className={cn(
											"data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
											isCollapsed &&
												"flex justify-center items-center p-2 h-10 w-10 mx-auto",
										)}
									>
										<div
											className={cn(
												"flex items-center gap-2",
												isCollapsed && "justify-center",
											)}
										>
											<div
												className={cn(
													"flex items-center justify-center rounded-sm border",
													"size-6",
												)}
											>
												<Logo
													className={cn(
														"transition-all",
														isCollapsed ? "size-4" : "size-5",
													)}
													logoUrl={activeOrganization?.logo || undefined}
												/>
											</div>
											<div
												className={cn(
													"flex flex-col items-start",
													isCollapsed && "hidden",
												)}
											>
												<p className="text-sm font-medium leading-none">
													{activeOrganization?.name ?? "Select Organization"}
												</p>
											</div>
										</div>
										<ChevronsUpDown
											className={cn("ml-auto", isCollapsed && "hidden")}
										/>
									</SidebarMenuButton>
								}
							/>
							<DropdownMenu.Content
								className="rounded-lg max-h-[min(70vh,28rem)] flex flex-col"
								align="start"
								side={isMobile ? "bottom" : "right"}
								sideOffset={4}
							>
								<DropdownMenu.Label className="text-xs text-muted-foreground shrink-0">
									Organizations
								</DropdownMenu.Label>
								<div className="overflow-y-auto overflow-x-hidden min-h-0 -mx-1 px-1">
									{organizations?.map((org) => {
										const isDefault = org.members?.[0]?.isDefault ?? false;
										return (
											<div
												className="flex flex-row justify-between"
												key={org.name}
											>
												<DropdownMenu.Item
													onClick={async () => {
														await authClient.organization.setActive({
															organizationId: org.id,
														});
														window.location.reload();
													}}
													className="w-full gap-2 p-2"
												>
													<div className="flex flex-col gap-1">
														<div className="flex items-center gap-2">
															{org.name}
														</div>
													</div>
													<div className="flex size-6 items-center justify-center rounded-sm border">
														<Logo
															className={cn(
																"transition-all",
																state === "collapsed" ? "size-6" : "size-10",
															)}
															logoUrl={org.logo ?? undefined}
														/>
													</div>
												</DropdownMenu.Item>

												<div className="flex items-center gap-2">
													<Button
														variant="ghost"
														shape="square"
														aria-label={
															isDefault
																? "Default organization"
																: "Set as default organization"
														}
														className={cn(
															"group",
															isDefault
																? "hover:bg-yellow-500/10"
																: "hover:bg-blue-500/10",
														)}
														loading={isSettingDefault && !isDefault}
														disabled={isDefault}
														onClick={async (e) => {
															if (isDefault) return;
															e.stopPropagation();
															await setDefaultOrganization({
																organizationId: org.id,
															})
																.then(() => {
																	refetch();
																	toast.success("Default organization updated");
																})
																.catch((error) => {
																	toast.error(
																		error?.message ||
																			"Error setting default organization",
																	);
																});
														}}
														title={
															isDefault
																? "Default organization"
																: "Set as default"
														}
													>
														{isDefault ? (
															<Star
																fill="#eab308"
																stroke="#eab308"
																className="size-4 text-yellow-500"
															/>
														) : (
															<Star
																fill="none"
																stroke="currentColor"
																className="size-4 text-gray-400 group-hover:text-blue-500 transition-colors"
															/>
														)}
													</Button>
													{org.ownerId === session?.user?.id && (
														<>
															<AddOrganization organizationId={org.id} />
															<DialogAction
																title="Delete Organization"
																description="Are you sure you want to delete this organization?"
																type="destructive"
																onClick={async () => {
																	await deleteOrganization({
																		organizationId: org.id,
																	})
																		.then(() => {
																			refetch();
																			toast.success(
																				"Organization deleted successfully",
																			);
																		})
																		.catch((error) => {
																			toast.error(
																				error?.message ||
																					"Error deleting organization",
																			);
																		});
																}}
															>
																<Button
																	variant="ghost"
																	shape="square"
																	aria-label="Delete organization"
																	className="group hover:bg-red-500/10"
																	loading={isRemoving}
																>
																	<Trash2 className="size-4 text-primary group-hover:text-red-500" />
																</Button>
															</DialogAction>
														</>
													)}
												</div>
											</div>
										);
									})}
								</div>
								{(user?.role === "owner" ||
									user?.role === "admin" ||
									isCloud) && (
									<>
										<DropdownMenu.Separator />
										<AddOrganization />
									</>
								)}
							</DropdownMenu.Content>
						</DropdownMenu>
					</SidebarMenuItem>

					{/* Notification Bell */}
					<SidebarMenuItem className={cn(isCollapsed && "mt-2")}>
						<DropdownMenu>
							<DropdownMenu.Trigger
								render={
									<Button
										variant="ghost"
										shape="square"
										aria-label="Open invitations"
										className={cn(
											"relative",
											isCollapsed && "h-8 w-8 p-1.5 mx-auto",
										)}
									>
										<Bell className="size-4" />
										{invitations && invitations.length > 0 && (
											<span className="absolute -top-0 -right-0 flex size-4 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
												{invitations.length}
											</span>
										)}
									</Button>
								}
							/>
							<DropdownMenu.Content
								align="start"
								side={"right"}
								className="w-80"
							>
								<DropdownMenu.Label>Pending Invitations</DropdownMenu.Label>
								<div className="flex flex-col gap-2">
									{invitations && invitations.length > 0 ? (
										invitations.map((invitation) => (
											<div key={invitation.id} className="flex flex-col gap-2">
												<DropdownMenu.Item
													className="flex flex-col items-start gap-1 p-3"
													onSelect={(e) => e.preventDefault()}
												>
													<div className="font-medium">
														{invitation?.organization?.name}
													</div>
													<div className="text-xs text-muted-foreground">
														Expires:{" "}
														{new Date(invitation.expiresAt).toLocaleString()}
													</div>
													<div className="text-xs text-muted-foreground">
														Role: {invitation.role}
													</div>
												</DropdownMenu.Item>
												<DialogAction
													title="Accept Invitation"
													description="Are you sure you want to accept this invitation?"
													type="default"
													onClick={async () => {
														const { error } =
															await authClient.organization.acceptInvitation({
																invitationId: invitation.id,
															});

														if (error) {
															toast.error(
																error.message || "Error accepting invitation",
															);
														} else {
															toast.success("Invitation accepted successfully");
															await refetchInvitations();
															await refetch();
														}
													}}
												>
													<Button size="sm" variant="secondary">
														Accept Invitation
													</Button>
												</DialogAction>
											</div>
										))
									) : (
										<DropdownMenu.Item disabled>
											No pending invitations
										</DropdownMenu.Item>
									)}
								</div>
							</DropdownMenu.Content>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			)}
		</>
	);
}

function MobileCloser() {
	const pathname = usePathname() ?? "";
	const { setOpenMobile, isMobile } = useSidebar();

	useEffect(() => {
		if (isMobile) {
			setOpenMobile(false);
		}
	}, [pathname, isMobile, setOpenMobile]);

	return null;
}

export default function Page({ children }: Props) {
	const [defaultOpen, setDefaultOpen] = useState<boolean | undefined>(
		undefined,
	);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		const cookieValue = document.cookie
			.split("; ")
			.find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
			?.split("=")[1];

		setDefaultOpen(cookieValue === undefined ? true : cookieValue === "true");
		setIsLoaded(true);
	}, []);

	const pathname = usePathname() ?? "";
	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: docklandsVersion } =
		api.settings.getDocklandsVersion.useQuery();

	const includesProjects = pathname?.includes("/dashboard/project");
	const { data: isCloud } = api.settings.isCloud.useQuery();

	const {
		home: filteredHome,
		settings: filteredSettings,
		help,
	} = createMenuForAuthUser({
		auth,
		permissions,
		isCloud: !!isCloud,
	});

	const activeItem = findActiveNavItem(
		[...filteredHome, ...filteredSettings],
		pathname,
	);

	if (!isLoaded) {
		return <div className="w-full h-screen bg-background" />; // Placeholder mientras se carga
	}

	return (
		<SidebarProvider
			defaultOpen={defaultOpen}
			open={defaultOpen}
			collapsible="icon"
			variant="floating"
			onOpenChange={(open) => {
				setDefaultOpen(open);

				// biome-ignore lint/suspicious/noDocumentCookie: this sets the cookie to keep the sidebar state.
				document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}`;
			}}
			style={
				{
					"--sidebar-width": "19.5rem",
					"--sidebar-width-mobile": "19.5rem",
				} as React.CSSProperties
			}
		>
			<MobileCloser />
			<Sidebar>
				<SidebarHeader>
					{/* <SidebarMenuButton
						className="group-data-[collapsible=icon]:!p-0"
						size="lg"
					> */}
					<LogoWrapper />
					{/* </SidebarMenuButton> */}
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Canvas</SidebarGroupLabel>
						<SidebarMenu>
							{filteredHome.map((item) => {
								const isSingle = item.isSingle !== false;
								const isActive = isSingle
									? isActiveRoute({ itemUrl: item.url, pathname })
									: item.items.some((item) =>
											isActiveRoute({ itemUrl: item.url, pathname }),
										);

								return (
									<SidebarMenuItem key={item.title}>
										{isSingle ? (
											<SidebarMenuButton
												href={item.url}
												tooltip={item.title}
												active={isActive}
												icon={item.icon}
												className={cn(isActive && "bg-border")}
											>
												<span>{item.title}</span>
											</SidebarMenuButton>
										) : (
											<Collapsible.Root
												defaultOpen={isActive}
												className="group/collapsible"
											>
												<Collapsible.Trigger
													render={
														<SidebarMenuButton
															tooltip={item.title}
															active={isActive}
															icon={item.icon}
														>
															<span>{item.title}</span>
															{item.items?.length && (
																<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
															)}
														</SidebarMenuButton>
													}
												/>
												<Collapsible.Panel>
													<SidebarMenuSub>
														{item.items?.map((subItem) => {
															const subActive = isActiveRoute({
																itemUrl: subItem.url,
																pathname,
															});

															return (
																<SidebarMenuSubItem key={subItem.title}>
																	<SidebarMenuSubButton
																		href={subItem.url}
																		active={subActive}
																		className={cn(subActive && "bg-border")}
																	>
																		{subItem.icon && (
																			<span className="mr-2">
																				<subItem.icon
																					className={cn(
																						"h-4 w-4 text-muted-foreground",
																						subActive && "text-primary",
																					)}
																				/>
																			</span>
																		)}
																		<span>{subItem.title}</span>
																	</SidebarMenuSubButton>
																</SidebarMenuSubItem>
															);
														})}
													</SidebarMenuSub>
												</Collapsible.Panel>
											</Collapsible.Root>
										)}
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
					<SidebarGroup>
						<SidebarGroupLabel>Control Plane</SidebarGroupLabel>
						<SidebarMenu className="gap-1">
							{filteredSettings.map((item) => {
								const isSingle = item.isSingle !== false;
								const isActive = isSingle
									? isActiveRoute({ itemUrl: item.url, pathname })
									: item.items.some((item) =>
											isActiveRoute({ itemUrl: item.url, pathname }),
										);

								return (
									<SidebarMenuItem key={item.title}>
										{isSingle ? (
											<SidebarMenuButton
												href={item.url}
												tooltip={item.title}
												active={isActive}
												icon={item.icon}
												className={cn(isActive && "bg-border")}
											>
												<span>{item.title}</span>
											</SidebarMenuButton>
										) : (
											<Collapsible.Root
												defaultOpen={isActive}
												className="group/collapsible"
											>
												<Collapsible.Trigger
													render={
														<SidebarMenuButton
															tooltip={item.title}
															active={isActive}
															icon={item.icon}
														>
															<span>{item.title}</span>
															{item.items?.length && (
																<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
															)}
														</SidebarMenuButton>
													}
												/>
												<Collapsible.Panel>
													<SidebarMenuSub>
														{item.items?.map((subItem) => {
															const subActive = isActiveRoute({
																itemUrl: subItem.url,
																pathname,
															});

															return (
																<SidebarMenuSubItem key={subItem.title}>
																	<SidebarMenuSubButton
																		href={subItem.url}
																		active={subActive}
																		className={cn(subActive && "bg-border")}
																	>
																		{subItem.icon && (
																			<span className="mr-2">
																				<subItem.icon
																					className={cn(
																						"h-4 w-4 text-muted-foreground",
																						subActive && "text-primary",
																					)}
																				/>
																			</span>
																		)}
																		<span>{subItem.title}</span>
																	</SidebarMenuSubButton>
																</SidebarMenuSubItem>
															);
														})}
													</SidebarMenuSub>
												</Collapsible.Panel>
											</Collapsible.Root>
										)}
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
					<SidebarGroup className="group-data-[collapsible=icon]:hidden">
						<SidebarGroupLabel>Resources</SidebarGroupLabel>
						<SidebarMenu>
							{help.map((item: ExternalLink) => (
								<SidebarMenuItem key={item.name}>
									<SidebarMenuButton
										href={item.url}
										target="_blank"
										icon={item.icon}
									>
										<span>{item.name}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<SidebarMenu className="flex flex-col gap-2">
						{!isCloud && permissions?.organization.update && (
							<SidebarMenuItem>
								<UpdateServerButton />
							</SidebarMenuItem>
						)}
						<SidebarMenuItem>
							<UserNav />
						</SidebarMenuItem>
						{docklandsVersion && (
							<div className="px-3 text-xs text-muted-foreground text-center group-data-[collapsible=icon]:hidden">
								Version {docklandsVersion}
							</div>
						)}
					</SidebarMenu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<main className="flex min-h-svh flex-1 flex-col">
				{!includesProjects && (
					<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
						<div className="flex items-center justify-between w-full px-4">
							<div className="flex items-center gap-2">
								<SidebarTrigger className="-ml-1" />
								<Separator orientation="vertical" className="mr-2 h-4" />
								<Breadcrumbs>
									<Breadcrumbs.Link href={activeItem?.url || "/"}>
										{activeItem?.title}
									</Breadcrumbs.Link>
								</Breadcrumbs>
							</div>
							{!isCloud && <TimeBadge />}
						</div>
					</header>
				)}

				<div className="flex flex-col w-full p-4 pt-0">{children}</div>
			</main>
		</SidebarProvider>
	);
}
