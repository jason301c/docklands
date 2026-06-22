"use client";

import { ShowContainers } from "@/components/dashboard/container-runtime/show/show-containers";
import { ServerFilter } from "@/components/shared/server-filter";

const Dashboard = () => {
	return (
		<ServerFilter>
			{(serverId) => <ShowContainers serverId={serverId} />}
		</ServerFilter>
	);
};

export default Dashboard;
