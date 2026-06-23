"use client";

import { usePermissions } from "@/client/hooks/use-permissions";
import { ShowInvitations } from "@/components/dashboard/settings/users/show-invitations";
import { ShowUsers } from "@/components/dashboard/settings/users/show-users";

const Page = () => {
	const { permissions } = usePermissions();
	const canCreateMembers = permissions?.member.create ?? false;

	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowUsers />
			{canCreateMembers && <ShowInvitations />}
		</div>
	);
};

export default Page;
