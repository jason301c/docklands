import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { SidebarMenuButton } from "@cloudflare/kumo/components/sidebar";
import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/shared/avatar";
import { ModeToggle } from "@/components/shared/mode-toggle";
import { getFallbackAvatarInitials } from "@/shared/utils";

const _AUTO_CHECK_UPDATES_INTERVAL_MINUTES = 7;

export const UserNav = () => {
	const router = useRouter();
	const { data } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const userName =
		`${data?.user?.firstName ?? ""} ${data?.user?.lastName ?? ""}`.trim() ||
		data?.user?.email ||
		"User";

	// const { mutateAsync } = api.auth.logout.useMutation();

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<SidebarMenuButton
						size="base"
						className="h-auto min-h-14 w-full gap-3 px-2 py-2 data-[state=open]:bg-kumo-fill-hover data-[state=open]:text-kumo-default group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
					>
						<Avatar className="h-8 w-8 shrink-0 rounded-lg">
							<AvatarImage
								className="object-cover"
								src={data?.user?.image || undefined}
								alt={`${userName} avatar`}
							/>
							<AvatarFallback className="rounded-lg">
								{getFallbackAvatarInitials(userName)}
							</AvatarFallback>
						</Avatar>
						<div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate font-semibold">Account</span>
							<span className="truncate text-xs text-kumo-subtle">
								{data?.user?.email}
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
					</SidebarMenuButton>
				}
			/>
			<DropdownMenu.Content
				className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
				side="bottom"
				align="end"
				sideOffset={4}
			>
				<div className="flex items-center justify-between px-2 py-1.5">
					<div className="min-w-0">
						<DropdownMenu.Label>My Account</DropdownMenu.Label>
						<span className="text-xs font-normal text-kumo-subtle">
							{data?.user?.email}
						</span>
					</div>
					<ModeToggle />
				</div>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item
						className="cursor-pointer"
						onClick={() => {
							router.push("/dashboard/settings/profile");
						}}
					>
						Profile
					</DropdownMenu.Item>
					<DropdownMenu.Item
						className="cursor-pointer"
						onClick={() => {
							router.push("/dashboard/workspace");
						}}
					>
						Workspace
					</DropdownMenu.Item>
					{!isCloud ? (
						<>
							<DropdownMenu.Item
								className="cursor-pointer"
								onClick={() => {
									router.push("/dashboard/host-metrics");
								}}
							>
								Host metrics
							</DropdownMenu.Item>
							{permissions?.traefikFiles.read && (
								<DropdownMenu.Item
									className="cursor-pointer"
									onClick={() => {
										router.push("/dashboard/proxy-files");
									}}
								>
									Proxy files
								</DropdownMenu.Item>
							)}
							{permissions?.docker.read && (
								<DropdownMenu.Item
									className="cursor-pointer"
									onClick={() => {
										router.push("/dashboard/container-runtime");
									}}
								>
									Container runtime
								</DropdownMenu.Item>
							)}
						</>
					) : (
						permissions?.organization.update && (
							<DropdownMenu.Item
								className="cursor-pointer"
								onClick={() => {
									router.push("/dashboard/settings/runtime");
								}}
							>
								Runtime workers
							</DropdownMenu.Item>
						)
					)}
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					className="cursor-pointer"
					onClick={async () => {
						await authClient.signOut().then(() => {
							router.push("/");
						});
						// await mutateAsync().then(() => {
						// 	router.push("/");
						// });
					}}
				>
					Log out
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
