"use client";

import { ContainerFreeMonitoring } from "@/components/dashboard/metrics/free/container/show-free-container-monitoring";

const Dashboard = () => {
	return (
		<div className="space-y-4 pb-10">
			<div className="rounded-lg border bg-kumo-canvas p-6">
				<ContainerFreeMonitoring appName="docklands" />
			</div>
		</div>
	);
};

export default Dashboard;
