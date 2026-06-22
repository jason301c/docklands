"use client";

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useState } from "react";
import { ShowSwarmContainers } from "@/components/dashboard/swarm/containers/show-swarm-containers";
import SwarmMonitorCard from "@/components/dashboard/swarm/monitoring-card";
import { ServerFilter } from "@/components/shared/server-filter";

const Dashboard = () => {
	const [activeTab, setActiveTab] = useState("overview");

	return (
		<ServerFilter>
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
							<SwarmMonitorCard serverId={serverId} />
						</div>
					)}
					{activeTab === "containers" && (
						<div>
							<LayerCard className="h-full bg-sidebar p-2.5 rounded-xl mx-auto w-full">
								<div className="rounded-xl bg-background shadow-md p-6">
									<ShowSwarmContainers serverId={serverId} />
								</div>
							</LayerCard>
						</div>
					)}
				</div>
			)}
		</ServerFilter>
	);
};

export default Dashboard;
