"use client";

import { ShowNodes } from "@/components/dashboard/settings/cluster/nodes/show-nodes";
import { ServerFilter } from "@/components/shared/server-filter";

const Page = () => {
	return (
		<ServerFilter>
			{(serverId) => (
				<div className="flex flex-col gap-4 w-full">
					<ShowNodes serverId={serverId} />
				</div>
			)}
		</ServerFilter>
	);
};

export default Page;
