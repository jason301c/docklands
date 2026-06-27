"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useState } from "react";
import { usePermissions } from "@/client/hooks/use-permissions";
import ClusterMonitorCard from "@/components/dashboard/cluster-runtime/monitoring-card";
import { ShowContainers } from "@/components/dashboard/container-runtime/show/show-containers";
import { ContainerMonitoring } from "@/components/dashboard/metrics/container/show-container-monitoring";
import { PageHeader } from "@/components/shared/page-header";
import { PageSection } from "@/components/shared/page-section";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

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
		<PageSection>
			<PageHeader title="Runtime" />

			{tabs.length > 1 && (
				<Tabs
					className="w-fit self-start"
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
				<ContainerMonitoring appName="docklands" hideHeader />
			)}
		</PageSection>
	);
};

export default RuntimeClient;
