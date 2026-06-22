"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShowBuildsTable } from "@/components/dashboard/builds/show-builds-table";
import { ShowQueueTable } from "@/components/dashboard/builds/show-queue-table";

const TAB_VALUES = ["history", "queue"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isValidTab(t: string): t is TabValue {
	return TAB_VALUES.includes(t as TabValue);
}

function DeploymentsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const tabParam = searchParams?.get("tab");
	const tab =
		tabParam === "builds"
			? "history"
			: tabParam && isValidTab(tabParam)
				? tabParam
				: "history";

	const setTab = (value: string) => {
		if (!isValidTab(value)) return;
		router.replace(`/dashboard/deployments?tab=${value}`, { scroll: false });
	};

	return (
		<div className="w-full">
			<div className="min-h-[45vh] rounded-lg border bg-background p-6">
				<div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h3 className="flex items-center gap-2 text-xl font-bold">
								<Rocket className="size-5" />
								Deployments
							</h3>
							<p>Deployment history and worker queue across every service.</p>
						</div>
					</div>
					<Tabs
						value={tab}
						onValueChange={(value) => value !== null && setTab(value as never)}
						className="mt-2 w-full"
						tabs={[
							{ value: "history", label: "History" },
							{ value: "queue", label: "Worker queue" },
						]}
					/>
					{tab === "history" && (
						<div className="mt-0 pt-4">
							<ShowBuildsTable />
						</div>
					)}
					{tab === "queue" && (
						<div className="mt-0 pt-4">
							<ShowQueueTable />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default DeploymentsPage;
