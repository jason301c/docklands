"use client";

import { ShowClusterNodes } from "@/components/dashboard/settings/cluster-nodes/show-cluster-nodes";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

const Page = () => {
	return (
		<RuntimeWorkerFilter>
			{(serverId) => (
				<div className="flex flex-col gap-4 w-full">
					<ShowClusterNodes serverId={serverId} />
				</div>
			)}
		</RuntimeWorkerFilter>
	);
};

export default Page;
