"use client";
import { Button } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
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
	useSidebar,
} from "@cloudflare/kumo/components/sidebar";
import { Bell, ChevronRight, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import { useCurrentUser } from "@/client/hooks/use-current-user";
import { usePermissions } from "@/client/hooks/use-permissions";
import { DropdownMenu } from "@/components/shared/dropdown";
import { toast } from "@/components/shared/toast";
import {
	createMenuForAuthUser,
	type ExternalLink,
	isActiveRoute,
	type NavItem,
} from "@/shared/dashboard-nav";
import { cn } from "@/shared/utils";
import { DialogAction } from "../shared/dialog-action";
import { Logo } from "../shared/logo";
import { ModeToggle } from "../shared/mode-toggle";
import { RuntimeUpdateButton } from "./runtime-update";
import { UserNav } from "./user-nav";

interface Props {
	children: React.ReactNode;
}

function LogoWrapper() {
	return <SidebarLogo />;
}

function SidebarLogo() {
	const { state } = useSidebar();
	const { isMobile } = useSidebar();
	const isCollapsed = state === "collapsed" && !isMobile;
	const { data: activeOrganization, isLoading } =
		api.organization.active.useQuery();
	const { data: docklandsVersion } =
		api.settings.getDocklandsVersion.useQuery();

	const { data: invitations, refetch: refetchInvitations } =
		api.user.getInvitations.useQuery();

	return (
		<>
			{isLoading ? (
				<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[5vh] pt-4">
					<Loader2 className="animate-spin size-4" />
				</div>
			) : (
				<SidebarMenu
					className={cn(
						"flex gap-1",
						isCollapsed
							? "flex-col items-center"
							: "flex-row items-center justify-between",
					)}
				>
					{/* Instance identity — single-tenant, so no organization switcher */}
					<SidebarMenuItem className={cn("min-w-0", !isCollapsed && "flex-1")}>
						<div
							className={cn(
								"flex h-auto items-center gap-2.5 px-1",
								isCollapsed && "min-h-10 justify-center px-0",
							)}
						>
							<Logo
								className="size-7 shrink-0 transition-all"
								logoUrl={activeOrganization?.logo || undefined}
							/>
							<div
								className={cn(
									"grid min-w-0 flex-1 text-left leading-tight",
									isCollapsed && "hidden",
								)}
							>
								<span className="truncate font-display text-sm font-semibold">
									{activeOrganization?.name ?? "Docklands"}
								</span>
								{docklandsVersion && (
									<span className="truncate text-xs text-kumo-subtle">
										{docklandsVersion}
									</span>
								)}
							</div>
						</div>
					</SidebarMenuItem>

					{/* Instance actions — settings + notifications */}
					<SidebarMenuItem
						className={cn(
							"flex shrink-0 items-center gap-0.5",
							isCollapsed && "mt-2 flex-col",
						)}
					>
						<ModeToggle variant="ghost" />
						<DropdownMenu>
							<DropdownMenu.Trigger
								render={
									<Button
										variant="ghost"
										shape="square"
										aria-label="Open invitations"
										className="relative"
									>
										<Bell className="size-4" />
										{invitations && invitations.length > 0 && (
											<span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-kumo-info text-xs text-white">
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
								<DropdownMenu.Group>
									<DropdownMenu.Label>Pending Invitations</DropdownMenu.Label>
								</DropdownMenu.Group>
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
													<div className="text-xs text-kumo-subtle">
														Expires:{" "}
														{new Date(invitation.expiresAt).toLocaleString()}
													</div>
													<div className="text-xs text-kumo-subtle">
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
															// Reload so the session picks up the membership the
															// user just joined (role, permissions, nav).
															window.location.reload();
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

/**
 * Renders one nav group's items (single links and collapsible groups). Shared
 * by the "Canvas" and "Control Plane" groups, which previously duplicated this
 * exact Collapsible/SidebarMenuButton/SidebarMenuSub composition verbatim.
 */
function NavMenuItems({
	items,
	pathname,
}: {
	items: NavItem[];
	pathname: string;
}) {
	return items.map((item) => {
		const isSingle = item.isSingle !== false;
		const isActive = isSingle
			? isActiveRoute({ itemUrl: item.url, pathname })
			: item.items.some((subItem) =>
					isActiveRoute({ itemUrl: subItem.url, pathname }),
				);

		return (
			<SidebarMenuItem key={item.title}>
				{isSingle ? (
					<SidebarMenuButton
						href={item.url}
						tooltip={item.title}
						active={isActive}
						icon={item.icon}
						className={cn(isActive && "bg-kumo-fill")}
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
												className={cn(subActive && "bg-kumo-fill")}
											>
												{subItem.icon && (
													<span className="mr-2">
														<subItem.icon
															className={cn(
																"h-4 w-4 text-kumo-subtle",
																subActive && "text-kumo-brand",
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
	});
}

export default function Page({ children }: Props) {
	const pathname = usePathname() ?? "";
	const { user: auth } = useCurrentUser();
	const { permissions } = usePermissions();

	const {
		home: filteredHome,
		settings: filteredSettings,
		help,
	} = createMenuForAuthUser({
		auth,
		permissions,
	});

	return (
		<SidebarProvider
			collapsible="none"
			variant="sidebar"
			className="h-svh overflow-hidden"
			style={
				{
					"--sidebar-width": "19.5rem",
					"--sidebar-width-mobile": "19.5rem",
				} as React.CSSProperties
			}
		>
			<MobileCloser />
			<Sidebar className="h-svh min-h-svh" contentClassName="h-svh min-h-svh">
				<SidebarHeader className="h-auto flex-col items-stretch gap-2 overflow-visible border-b bg-(--sidebar-bg) p-2">
					<LogoWrapper />
					{permissions?.organization.update && <RuntimeUpdateButton />}
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Canvas</SidebarGroupLabel>
						<SidebarMenu>
							<NavMenuItems items={filteredHome} pathname={pathname} />
						</SidebarMenu>
					</SidebarGroup>
					<SidebarGroup>
						<SidebarGroupLabel>Control Plane</SidebarGroupLabel>
						<SidebarMenu className="gap-1">
							<NavMenuItems items={filteredSettings} pathname={pathname} />
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
				<SidebarFooter className="h-auto flex-col items-stretch overflow-visible border-t bg-(--sidebar-bg) p-2">
					<SidebarMenu>
						<SidebarMenuItem>
							<UserNav />
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>
			<main className="flex h-svh min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-kumo-canvas">
				<div className="flex w-full flex-1 flex-col p-4">
					<div className="flex w-full flex-1 flex-col">{children}</div>
				</div>
			</main>
		</SidebarProvider>
	);
}
