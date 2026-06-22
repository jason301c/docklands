import { notFound } from "next/navigation";
import { requireUser } from "@/server/web/app-auth";
import type { WorkspaceServiceType } from "@/shared/workspace-graph";
import ApplicationClient from "./_clients/application-client";
import ComposeClient from "./_clients/compose-client";
import LibsqlClient from "./_clients/libsql-client";
import MariadbClient from "./_clients/mariadb-client";
import MongoClient from "./_clients/mongo-client";
import MysqlClient from "./_clients/mysql-client";
import PostgresClient from "./_clients/postgres-client";
import RedisClient from "./_clients/redis-client";

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
		projectId: workspaceId,
		environmentId,
		activeTab: activeTab as never,
	};

	switch (serviceType as WorkspaceServiceType) {
		case "application":
			return <ApplicationClient {...routeProps} applicationId={serviceId} />;
		case "compose":
			return <ComposeClient {...routeProps} composeId={serviceId} />;
		case "postgres":
			return <PostgresClient {...routeProps} postgresId={serviceId} />;
		case "mysql":
			return <MysqlClient {...routeProps} mysqlId={serviceId} />;
		case "mariadb":
			return <MariadbClient {...routeProps} mariadbId={serviceId} />;
		case "mongo":
			return <MongoClient {...routeProps} mongoId={serviceId} />;
		case "redis":
			return <RedisClient {...routeProps} redisId={serviceId} />;
		case "libsql":
			return <LibsqlClient {...routeProps} libsqlId={serviceId} />;
		default:
			notFound();
	}
}
