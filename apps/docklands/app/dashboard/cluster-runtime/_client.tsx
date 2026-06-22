"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useState } from "react";
import { ShowClusterContainers } from "@/components/dashboard/cluster-runtime/containers/show-cluster-containers";
import ClusterMonitorCard from "@/components/dashboard/cluster-runtime/monitoring-card";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

const Dashboard = () => {
	const [activeTab, setActiveTab] = useState("overview");

	return (
		<RuntimeWorkerFilter>
			{(serverId) => (
				<div className="space-y-4">
					<Tabs
						value={activeTab}
						onValueChange={(value) =>
							value !== null && setActiveTab(value as never)
						}
						tabs={[
							{ value: "overview", label: "Overview" },
							{ value: "containers", label: "Containers" },
						]}
					/>
					{activeTab === "overview" && (
						<div>
							<ClusterMonitorCard serverId={serverId} />
						</div>
					)}
					{activeTab === "containers" && (
						<div className="rounded-lg border bg-background p-6">
							<ShowClusterContainers serverId={serverId} />
						</div>
					)}
				</div>
			)}
		</RuntimeWorkerFilter>
	);
};

export default Dashboard;
