"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useState } from "react";
import { usePermissions } from "@/client/hooks/use-permissions";
import { ShowIngressFiles } from "@/components/dashboard/proxy-files/show-ingress-files";
import { ShowRequests } from "@/components/dashboard/requests/show-requests";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

type IngressTab = "requests" | "files";

const IngressClient = () => {
	const { can } = usePermissions();
	const canRequests = can("docker", "read");
	const canFiles = can("traefikFiles", "read");

	const tabs = [
		canRequests && { value: "requests" as const, label: "Requests" },
		canFiles && { value: "files" as const, label: "Files" },
	].filter((tab): tab is { value: IngressTab; label: string } => Boolean(tab));

	const [activeTab, setActiveTab] = useState<IngressTab>("requests");
	const currentTab = tabs.some((tab) => tab.value === activeTab)
		? activeTab
		: (tabs[0]?.value ?? "requests");

	return (
		<div className="space-y-4 pb-10">
			{tabs.length > 1 && (
				<Tabs
					value={currentTab}
					onValueChange={(value) =>
						value !== null && setActiveTab(value as IngressTab)
					}
					tabs={tabs}
				/>
			)}

			{currentTab === "requests" && <ShowRequests />}

			{currentTab === "files" && (
				<RuntimeWorkerFilter>
					{(runtimeWorkerId) => (
						<ShowIngressFiles runtimeWorkerId={runtimeWorkerId} />
					)}
				</RuntimeWorkerFilter>
			)}
		</div>
	);
};

export default IngressClient;
