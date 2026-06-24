"use client";

import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ShowDeploymentsTable } from "@/components/dashboard/deployments/show-deployments-table";
import { ShowDeploymentQueueTable } from "@/components/dashboard/deployments/show-queue-table";
import { PageHeader } from "@/components/shared/page-header";
import { PageSection } from "@/components/shared/page-section";
import { LoadingState } from "@/components/shared/states";

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
			<PageSection className="min-h-[45vh] gap-0">
				<PageHeader title="Deployments" />
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
						<ShowDeploymentsTable />
					</div>
				)}
				{tab === "queue" && (
					<div className="mt-0 pt-4">
						<ShowDeploymentQueueTable />
					</div>
				)}
			</PageSection>
		</div>
	);
}

// `useSearchParams` requires a Suspense boundary above it; self-contain it here
// so the route no longer relies on the blanket `force-dynamic` to stay valid.
export default function DeploymentsRoute() {
	return (
		<Suspense fallback={<LoadingState />}>
			<DeploymentsPage />
		</Suspense>
	);
}
