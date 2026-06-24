"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceList } from "@/components/dashboard/workspace/manage/workspace-list";
import { WorkspaceOverview } from "@/components/dashboard/workspace/workspace-overview";
import { LoadingState } from "@/components/shared/states";
import { workspaceListView } from "@/shared/routes";

const Workspace = () => {
	const searchParams = useSearchParams();
	const view = searchParams?.get("view");

	if (view === workspaceListView) {
		return <WorkspaceList />;
	}

	return <WorkspaceOverview />;
};

// `useSearchParams` requires a Suspense boundary above it; self-contain it here
// so the route no longer relies on the blanket `force-dynamic` to stay valid.
export default function WorkspacePage() {
	return (
		<Suspense fallback={<LoadingState />}>
			<Workspace />
		</Suspense>
	);
}
