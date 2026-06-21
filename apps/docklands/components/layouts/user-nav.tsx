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

	// const { mutateAsync } = api.auth.logout.useMutation();

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<SidebarMenuButton
						size="base"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<Avatar className="h-8 w-8 rounded-lg">
							<AvatarImage
								className="object-cover"
								src={data?.user?.image || ""}
								alt={data?.user?.image || ""}
							/>
							<AvatarFallback className="rounded-lg">
								{getFallbackAvatarInitials(
									`${data?.user?.firstName} ${data?.user?.lastName}`.trim(),
								)}
							</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">Account</span>
							<span className="truncate text-xs">{data?.user?.email}</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4" />
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
					<DropdownMenu.Label className="flex flex-col">
						My Account
						<span className="text-xs font-normal text-muted-foreground">
							{data?.user?.email}
						</span>
					</DropdownMenu.Label>
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
							router.push("/dashboard/home");
						}}
					>
						Projects
					</DropdownMenu.Item>
					{!isCloud ? (
						<>
							<DropdownMenu.Item
								className="cursor-pointer"
								onClick={() => {
									router.push("/dashboard/monitoring");
								}}
							>
								Monitoring
							</DropdownMenu.Item>
							{permissions?.traefikFiles.read && (
								<DropdownMenu.Item
									className="cursor-pointer"
									onClick={() => {
										router.push("/dashboard/ingress");
									}}
								>
									Ingress files
								</DropdownMenu.Item>
							)}
							{permissions?.docker.read && (
								<DropdownMenu.Item
									className="cursor-pointer"
									onClick={() => {
										router.push("/dashboard/runtime");
									}}
								>
									Runtime containers
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
								Runtime capacity
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
