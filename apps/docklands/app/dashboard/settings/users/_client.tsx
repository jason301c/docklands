"use client";

import { usePermissions } from "@/client/hooks/use-permissions";
import { ShowPeople } from "@/components/dashboard/settings/users/show-people";

const Page = () => {
	const { permissions } = usePermissions();
	const canCreateMembers = permissions?.member.create ?? false;

	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowPeople canCreateMembers={canCreateMembers} />
		</div>
	);
};

export default Page;
