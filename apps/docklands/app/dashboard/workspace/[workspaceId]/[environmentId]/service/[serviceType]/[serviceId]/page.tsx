import { notFound } from "next/navigation";
import { requireUser } from "@/server/web/app-auth";
import type { WorkspaceServiceType } from "@/shared/workspace-graph";
import ApplicationClient from "./_clients/application-client";
import ComposeClient from "./_clients/compose-client";
import DatabaseClient from "./_clients/database-client";

type PageProps = {
	params: Promise<{
		workspaceId: string;
		environmentId: string;
		serviceType: string;
		serviceId: string;
	}>;
	searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
	await requireUser();
	const { workspaceId, environmentId, serviceType, serviceId } = await params;
	const resolvedSearchParams = await searchParams;
	const activeTab =
		typeof resolvedSearchParams.tab === "string"
			? resolvedSearchParams.tab
			: "general";

	const routeProps = {
		workspaceId: workspaceId,
		environmentId,
		activeTab: activeTab as never,
	};

	switch (serviceType as WorkspaceServiceType) {
		case "application":
			return <ApplicationClient {...routeProps} applicationId={serviceId} />;
		case "compose":
			return <ComposeClient {...routeProps} composeId={serviceId} />;
		case "postgres":
		case "mysql":
		case "mariadb":
		case "mongo":
		case "redis":
		case "libsql":
			return <DatabaseClient {...routeProps} databaseId={serviceId} />;
		default:
			notFound();
	}
}
