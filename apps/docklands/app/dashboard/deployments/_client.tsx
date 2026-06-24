"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { ShowDeploymentsTable } from "@/components/dashboard/deployments/show-deployments-table";
import { ShowDeploymentQueueTable } from "@/components/dashboard/deployments/show-queue-table";
import { PageHeader } from "@/components/shared/page-header";
import { PageSection } from "@/components/shared/page-section";
import { cn } from "@/shared/utils";

/**
 * The raw worker queue (internal job ids/states) is an operator/debug view, so
 * it lives in a collapsed disclosure below the unified timeline rather than as a
 * co-equal tab. The header always shows the live job count.
 */
function WorkerQueuePanel() {
	const [open, setOpen] = useState(false);
	const { data } = api.deployment.queueList.useQuery(undefined, {
		refetchInterval: (query) =>
			(query.state.data?.length ?? 0) > 0 ? 3000 : 15000,
	});
	const count = data?.length ?? 0;

	return (
		<div className="overflow-hidden rounded-md border">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className={cn(
					"flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-kumo-fill/40",
					open && "border-b",
				)}
			>
				{open ? (
					<ChevronDown className="size-4 text-kumo-subtle" />
				) : (
					<ChevronRight className="size-4 text-kumo-subtle" />
				)}
				<span className="text-sm font-medium">Worker queue</span>
				<Badge variant={count > 0 ? "warning" : "secondary"}>
					{count} {count === 1 ? "job" : "jobs"}
				</Badge>
				<span className="ml-auto text-xs text-kumo-subtle">
					Live worker job states
				</span>
			</button>
			{open && (
				<div className="p-4">
					<ShowDeploymentQueueTable embedded />
				</div>
			)}
		</div>
	);
}

export default function DeploymentsRoute() {
	return (
		<div className="w-full">
			<PageSection className="min-h-[45vh] gap-4">
				<PageHeader title="Deployments" />
				<ShowDeploymentsTable />
				<WorkerQueuePanel />
			</PageSection>
		</div>
	);
}
