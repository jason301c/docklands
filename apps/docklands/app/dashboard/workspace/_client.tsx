"use client";

import { useSearchParams } from "next/navigation";
import { WorkspaceList } from "@/components/dashboard/workspace/manage/workspace-list";
import { WorkspaceOverview } from "@/components/dashboard/workspace/workspace-overview";
import { workspaceListView } from "@/shared/routes";

const Workspace = () => {
	const searchParams = useSearchParams();
	const view = searchParams?.get("view");

	if (view === workspaceListView) {
		return <WorkspaceList />;
	}

	return <WorkspaceOverview />;
};

export default Workspace;
