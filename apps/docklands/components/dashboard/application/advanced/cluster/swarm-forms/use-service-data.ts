import { api } from "@/client/api/trpc";

/**
 * The service kinds the Advanced Orchestration (Swarm) forms operate on. An
 * "application" reads/writes through `api.application`; every managed-database
 * engine reads/writes through the unified `api.database`.
 */
export type SwarmServiceType =
	| "application"
	| "libsql"
	| "mariadb"
	| "mongo"
	| "mysql"
	| "postgres"
	| "redis";

/**
 * Resolves the correct `one` query and `update` mutation for an application vs a
 * managed database, collapsing the app-vs-db dispatch that every swarm sub-form
 * previously inlined. Each form passes both `applicationId` and `databaseId` in
 * its update payload (only the matching one is honored server-side), so callers
 * just need `mutateAsync`, plus `data`/`refetch` from the active query.
 */
export const useServiceData = (id: string, type: SwarmServiceType) => {
	const isApplication = type === "application";

	const applicationQuery = api.application.one.useQuery(
		{ applicationId: id },
		{ enabled: !!id && isApplication },
	);
	const databaseQuery = api.database.one.useQuery(
		{ databaseId: id },
		{ enabled: !!id && !isApplication },
	);
	const { data, refetch } = isApplication ? applicationQuery : databaseQuery;

	const applicationMutation = api.application.update.useMutation();
	const databaseMutation = api.database.update.useMutation();
	const { mutateAsync } = isApplication
		? applicationMutation
		: databaseMutation;

	return { data, refetch, mutateAsync };
};
