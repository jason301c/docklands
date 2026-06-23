"use client";

import { usePermissions } from "@/client/hooks/use-permissions";
import { ShowApiKeys } from "@/components/dashboard/settings/api/show-api-keys";
import { ProfileForm } from "@/components/dashboard/settings/profile/profile-form";

const Page = () => {
	const { permissions } = usePermissions();

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
