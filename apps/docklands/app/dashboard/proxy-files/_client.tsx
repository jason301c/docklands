"use client";

import { ShowIngressFiles } from "@/components/dashboard/proxy-files/show-ingress-files";
import { ServerFilter } from "@/components/shared/server-filter";

const Dashboard = () => {
	return (
		<ServerFilter>
			{(serverId) => <ShowIngressFiles serverId={serverId} />}
		</ServerFilter>
	);
};

export default Dashboard;
