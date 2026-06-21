"use client";

import { api } from "@/client/api/trpc";
import { ShowApiKeys } from "@/components/dashboard/settings/api/show-api-keys";
import { LinkingAccount } from "@/components/dashboard/settings/linking-account/linking-account";
import { ProfileForm } from "@/components/dashboard/settings/profile/profile-form";

const Page = () => {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();

	return (
		<div className="w-full">
			<div className="h-full rounded-xl max-w-5xl mx-auto flex flex-col gap-4">
				<ProfileForm />
				{isCloud && <LinkingAccount />}
				{permissions?.api.read && <ShowApiKeys />}
			</div>
		</div>
	);
};

export default Page;
