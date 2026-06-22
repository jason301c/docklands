"use client";

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShowDeploymentsTable } from "@/components/dashboard/deployments/show-deployments-table";
import { ShowQueueTable } from "@/components/dashboard/deployments/show-queue-table";

const TAB_VALUES = ["deployments", "queue"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isValidTab(t: string): t is TabValue {
	return TAB_VALUES.includes(t as TabValue);
}

function BuildsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const tabParam = searchParams?.get("tab");
	const tab = tabParam && isValidTab(tabParam) ? tabParam : "deployments";

	const setTab = (value: string) => {
		if (!isValidTab(value)) return;
		router.replace(`/dashboard/deployments?tab=${value}`, { scroll: false });
	};

	return (
		<div className="w-full">
			<LayerCard className="h-full bg-sidebar p-2.5 rounded-xl min-h-[45vh]">
				<div className="rounded-xl bg-background shadow-md h-full">
					<div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h3 className="text-xl font-bold flex items-center gap-2">
									<Rocket className="size-5" />
									Builds
								</h3>
								<p>Build history and worker queue across every service.</p>
							</div>
						</div>
						<Tabs
							value={tab}
							onValueChange={(value) =>
								value !== null && setTab(value as never)
							}
							className="mt-2 w-full"
							tabs={[
								{ value: "deployments", label: "History" },
								{ value: "queue", label: "Worker queue" },
							]}
						/>
						{tab === "deployments" && (
							<div className="mt-0 pt-4">
								<ShowDeploymentsTable />
							</div>
						)}
						{tab === "queue" && (
							<div className="mt-0 pt-4">
								<ShowQueueTable />
							</div>
						)}
					</div>
				</div>
			</LayerCard>
		</div>
	);
}

export default BuildsPage;
