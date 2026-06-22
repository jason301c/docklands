"use client";

import { api } from "@/client/api/trpc";
import { ShowApiKeys } from "@/components/dashboard/settings/api/show-api-keys";
import { ProfileForm } from "@/components/dashboard/settings/profile/profile-form";

const Page = () => {
	const { data: permissions } = api.user.getPermissions.useQuery();

	return (
		<div className="w-full">
			<div className="flex h-full w-full flex-col gap-4">
				<ProfileForm />
				{permissions?.api.read && <ShowApiKeys />}
			</div>
		</div>
	);
};

export default Page;
