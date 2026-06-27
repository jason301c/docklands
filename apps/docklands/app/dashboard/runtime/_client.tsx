"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useState } from "react";
import { usePermissions } from "@/client/hooks/use-permissions";
import ClusterMonitorCard from "@/components/dashboard/cluster-runtime/monitoring-card";
import { ShowContainers } from "@/components/dashboard/container-runtime/show/show-containers";
import { ContainerMonitoring } from "@/components/dashboard/metrics/container/show-container-monitoring";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";
import { SectionCard } from "@/components/shared/section-card";

type RuntimeTab = "containers" | "cluster" | "metrics";

const RuntimeClient = () => {
	const { can } = usePermissions();
	const canDocker = can("docker", "read");
	const canMetrics = can("monitoring", "read");

	const tabs = [
		canDocker && { value: "containers" as const, label: "Containers" },
		canDocker && { value: "cluster" as const, label: "Cluster" },
		canMetrics && { value: "metrics" as const, label: "Host Metrics" },
	].filter((tab): tab is { value: RuntimeTab; label: string } => Boolean(tab));

	const [activeTab, setActiveTab] = useState<RuntimeTab>("containers");
	const currentTab = tabs.some((tab) => tab.value === activeTab)
		? activeTab
		: (tabs[0]?.value ?? "containers");

	return (
		<div className="space-y-4 pb-10">
			{tabs.length > 1 && (
				<Tabs
					value={currentTab}
					onValueChange={(value) =>
						value !== null && setActiveTab(value as RuntimeTab)
					}
					tabs={tabs}
				/>
			)}

			{currentTab === "containers" && (
				<RuntimeWorkerFilter>
					{(runtimeWorkerId) => (
						<ShowContainers runtimeWorkerId={runtimeWorkerId} />
					)}
				</RuntimeWorkerFilter>
			)}

			{currentTab === "cluster" && (
				<RuntimeWorkerFilter>
					{(runtimeWorkerId) => (
						<ClusterMonitorCard runtimeWorkerId={runtimeWorkerId} />
					)}
				</RuntimeWorkerFilter>
			)}

			{currentTab === "metrics" && (
				<SectionCard title="Host Metrics">
					<ContainerMonitoring appName="docklands" />
				</SectionCard>
			)}
		</div>
	);
};

export default RuntimeClient;
