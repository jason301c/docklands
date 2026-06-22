"use client";

import { api } from "@/client/api/trpc";
import { ShowBackups } from "@/components/dashboard/database/backups/show-backups";
import { IngressDomain } from "@/components/dashboard/settings/ingress-domain";
import { IngressRuntime } from "@/components/dashboard/settings/ingress-runtime";

const Page = () => {
	const { data: user } = api.user.get.useQuery();
	return (
		<div className="w-full">
			<div className="flex h-full w-full flex-col gap-4">
				<IngressDomain />
				<IngressRuntime />
				<div className="w-full flex flex-col gap-4">
					<ShowBackups
						id={user?.userId ?? ""}
						databaseType="web-server"
						backupType="database"
					/>
				</div>
			</div>
		</div>
	);
};

export default Page;
