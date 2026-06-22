"use client";

import { ShowContainers } from "@/components/dashboard/container-runtime/show/show-containers";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

const Dashboard = () => {
	return (
		<RuntimeWorkerFilter>
			{(serverId) => <ShowContainers serverId={serverId} />}
		</RuntimeWorkerFilter>
	);
};

export default Dashboard;
