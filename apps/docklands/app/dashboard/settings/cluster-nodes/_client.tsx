"use client";

import { ShowClusterNodes } from "@/components/dashboard/settings/cluster-nodes/show-cluster-nodes";
import { ServerFilter } from "@/components/shared/server-filter";

const Page = () => {
	return (
		<ServerFilter>
			{(serverId) => (
				<div className="flex flex-col gap-4 w-full">
					<ShowClusterNodes serverId={serverId} />
				</div>
			)}
		</ServerFilter>
	);
};

export default Page;
