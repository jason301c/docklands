"use client";

import { ShowIngressFiles } from "@/components/dashboard/proxy-files/show-ingress-files";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

const Dashboard = () => {
	return (
		<RuntimeWorkerFilter>
			{(serverId) => <ShowIngressFiles serverId={serverId} />}
		</RuntimeWorkerFilter>
	);
};

export default Dashboard;
