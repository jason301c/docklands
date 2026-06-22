"use client";

import { ShowContainers } from "@/components/dashboard/container-runtime/show/show-containers";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

const Dashboard = () => {
	return (
		<RuntimeWorkerFilter>
			{(runtimeWorkerId) => (
				<ShowContainers runtimeWorkerId={runtimeWorkerId} />
			)}
		</RuntimeWorkerFilter>
	);
};

export default Dashboard;
