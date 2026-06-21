"use client";

import { ShowSwarmContainers } from "@/components/dashboard/swarm/containers/show-swarm-containers";
import SwarmMonitorCard from "@/components/dashboard/swarm/monitoring-card";
import { ServerFilter } from "@/components/shared/server-filter";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Dashboard = () => {
	return (
		<ServerFilter>
			{(serverId) => (
				<div className="space-y-4">
					<Tabs defaultValue="overview">
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="containers">Containers</TabsTrigger>
						</TabsList>
						<TabsContent value="overview">
							<SwarmMonitorCard serverId={serverId} />
						</TabsContent>
						<TabsContent value="containers">
							<Card className="h-full bg-sidebar p-2.5 rounded-xl mx-auto w-full">
								<div className="rounded-xl bg-background shadow-md p-6">
									<ShowSwarmContainers serverId={serverId} />
								</div>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
			)}
		</ServerFilter>
	);
};

export default Dashboard;
