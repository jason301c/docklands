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
import {
	Bell,
	ChevronRight,
	ChevronsUpDown,
	Loader2,
	Star,
	Trash2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import { Separator } from "@/components/shared/separator";
import { TimeBadge } from "@/components/shared/time-badge";
import { toast } from "@/components/shared/toast";
import {
	createMenuForAuthUser,
	type ExternalLink,
	findActiveNavItem,
	isActiveRoute,
} from "@/shared/dashboard-nav";
import { isWorkspaceDetailPath } from "@/shared/routes";
import { cn } from "@/shared/utils";
import { AddOrganization } from "../dashboard/organization/handle-organization";
import { DialogAction } from "../shared/dialog-action";
import { Logo } from "../shared/logo";
import { RuntimeUpdateButton } from "./runtime-update";
import { UserNav } from "./user-nav";

const SIDEBAR_COOKIE_NAME = "sidebar_state";

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
				<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[5vh] pt-4">
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
										size="base"
										className={cn(
											"h-auto min-h-14 w-full gap-3 px-2 py-2 data-[state=open]:bg-kumo-fill-hover data-[state=open]:text-kumo-default",
											isCollapsed && "min-h-10 justify-center px-1",
										)}
									>
										<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border">
											<Logo
												className="size-5 transition-all"
												logoUrl={activeOrganization?.logo || undefined}
											/>
										</div>
										<div
											className={cn(
												"grid min-w-0 flex-1 text-left text-sm leading-tight",
												isCollapsed && "hidden",
											)}
										>
											<span className="truncate font-semibold">
												{activeOrganization?.name ?? "Select Organization"}
											</span>
											{user?.role && (
												<span className="truncate text-xs text-kumo-subtle capitalize">
													{user.role}
												</span>
											)}
										</div>
										<ChevronsUpDown
											className={cn(
												"ml-auto size-4 shrink-0 text-kumo-subtle",
												isCollapsed && "hidden",
											)}
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
								<DropdownMenu.Group>
									<DropdownMenu.Label className="text-xs text-kumo-subtle shrink-0">
										Organizations
									</DropdownMenu.Label>
								</DropdownMenu.Group>
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
																? "hover:bg-kumo-warning/10"
																: "hover:bg-kumo-brand/10",
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
																className="size-4 text-kumo-warning"
															/>
														) : (
															<Star
																fill="none"
																stroke="currentColor"
																className="size-4 text-kumo-subtle group-hover:text-kumo-brand transition-colors"
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
																	className="group hover:bg-kumo-danger/10"
																	loading={isRemoving}
																>
																	<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
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
											<span className="absolute -top-0 -right-0 flex size-4 items-center justify-center rounded-full bg-kumo-info text-xs text-white">
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

	const includesProjects = isWorkspaceDetailPath(pathname);
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
	const isSettingsPath = pathname.startsWith("/dashboard/settings");

	if (!isLoaded) {
		return <div className="w-full h-screen bg-kumo-canvas" />; // Placeholder mientras se carga
	}

	return (
		<SidebarProvider
			defaultOpen={defaultOpen}
			open={defaultOpen}
			collapsible="icon"
			variant="sidebar"
			className="h-svh min-h-svh"
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
			<Sidebar className="h-svh min-h-svh" contentClassName="h-svh min-h-svh">
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
				<SidebarFooter className="h-auto flex-col items-stretch gap-0 overflow-visible border-t bg-kumo-canvas p-2 pb-3">
					<SidebarMenu className="flex flex-col gap-2">
						{!isCloud && permissions?.organization.update && (
							<SidebarMenuItem>
								<RuntimeUpdateButton />
							</SidebarMenuItem>
						)}
						<SidebarMenuItem>
							<UserNav />
						</SidebarMenuItem>
						{docklandsVersion && (
							<div className="px-3 text-xs text-kumo-subtle text-center group-data-[collapsible=icon]:hidden">
								Version {docklandsVersion}
							</div>
						)}
					</SidebarMenu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<main className="flex min-h-svh min-w-0 flex-1 flex-col bg-kumo-canvas">
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

				<div
					className={cn(
						"flex w-full flex-1 flex-col px-4 pb-8",
						includesProjects ? "pt-4" : "pt-0",
					)}
				>
					<div
						className={cn(
							"flex w-full flex-1 flex-col",
							isSettingsPath && "mx-auto max-w-5xl",
						)}
					>
						{children}
					</div>
				</div>
			</main>
		</SidebarProvider>
	);
}
