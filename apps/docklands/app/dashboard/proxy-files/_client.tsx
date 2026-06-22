"use client";

import { ShowTraefikSystem } from "@/components/dashboard/proxy-files/show-traefik-system";
import { ServerFilter } from "@/components/shared/server-filter";

const Dashboard = () => {
	return (
		<ServerFilter>
			{(serverId) => <ShowTraefikSystem serverId={serverId} />}
		</ServerFilter>
	);
};

export default Dashboard;
