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
import { DropdownMenu } from "@/components/shared/dropdown";
import { getFallbackAvatarInitials } from "@/shared/utils";

// The account page intentionally lives only in this account dropdown, not the
// sidebar nav. It is the signed-in user's own (ungated) profile, so it is
// rendered directly here rather than resolved from DASHBOARD_MENU.
const PROFILE_URL = "/dashboard/settings/profile";

export const UserNav = () => {
	const router = useRouter();
	const { data } = api.user.get.useQuery();
	const userName =
		`${data?.user?.firstName ?? ""} ${data?.user?.lastName ?? ""}`.trim() ||
		data?.user?.email ||
		"User";

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<SidebarMenuButton
						size="base"
						className="h-auto min-h-9 w-full gap-2.5 px-1 py-1 data-[state=open]:bg-kumo-fill-hover data-[state=open]:text-kumo-default group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
					>
						<Avatar className="size-7 shrink-0 rounded-lg border">
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
							<span className="truncate font-semibold">{userName}</span>
							<span className="truncate text-xs text-kumo-subtle">
								{data?.user?.email}
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4 shrink-0 text-kumo-subtle group-data-[collapsible=icon]:hidden" />
					</SidebarMenuButton>
				}
			/>
			<DropdownMenu.Content
				className="min-w-56 rounded-lg"
				side="bottom"
				align="end"
				sideOffset={4}
			>
				<DropdownMenu.Group>
					<DropdownMenu.Item onClick={() => router.push(PROFILE_URL)}>
						Profile
					</DropdownMenu.Item>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					variant="danger"
					onClick={async () => {
						await authClient.signOut().then(() => {
							router.push("/");
						});
					}}
				>
					Log out
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
