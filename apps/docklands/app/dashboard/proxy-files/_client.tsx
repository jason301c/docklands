"use client";

import { ShowIngressFiles } from "@/components/dashboard/proxy-files/show-ingress-files";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

const Dashboard = () => {
	return (
		<RuntimeWorkerFilter>
			{(runtimeWorkerId) => (
				<ShowIngressFiles runtimeWorkerId={runtimeWorkerId} />
			)}
		</RuntimeWorkerFilter>
	);
};

export default Dashboard;
