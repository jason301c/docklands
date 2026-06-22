"use client";

import { ShowClusterNodes } from "@/components/dashboard/settings/cluster-nodes/show-cluster-nodes";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

const Page = () => {
	return (
		<RuntimeWorkerFilter>
			{(runtimeWorkerId) => (
				<div className="flex flex-col gap-4 w-full">
					<ShowClusterNodes runtimeWorkerId={runtimeWorkerId} />
				</div>
			)}
		</RuntimeWorkerFilter>
	);
};

export default Page;
