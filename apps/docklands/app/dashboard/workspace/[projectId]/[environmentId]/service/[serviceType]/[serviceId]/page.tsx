import { notFound } from "next/navigation";
import ApplicationClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/application/[applicationId]/_client";
import ComposeClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/compose/[composeId]/_client";
import LibsqlClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/libsql/[libsqlId]/_client";
import MariadbClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/mariadb/[mariadbId]/_client";
import MongoClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/mongo/[mongoId]/_client";
import MysqlClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/mysql/[mysqlId]/_client";
import PostgresClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/postgres/[postgresId]/_client";
import RedisClient from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/redis/[redisId]/_client";
import { requireUser } from "@/server/web/app-auth";
import type { WorkspaceServiceType } from "@/shared/workspace-graph";

type PageProps = {
	params: Promise<{
		projectId: string;
		environmentId: string;
		serviceType: string;
		serviceId: string;
	}>;
	searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
	await requireUser();
	const { projectId, environmentId, serviceType, serviceId } = await params;
	const resolvedSearchParams = await searchParams;
	const activeTab =
		typeof resolvedSearchParams.tab === "string"
			? resolvedSearchParams.tab
			: "general";

	const routeProps = {
		projectId,
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
