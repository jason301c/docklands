import type { WorkspaceVariableSourceType } from "@/shared/workspace-graph";

/**
 * Browser-side display labels for each managed database engine. Mirrors the
 * `label` field of the server-side engine registry, kept local so client
 * components do not import from `server/`.
 */
export const ENGINE_LABELS: Record<WorkspaceVariableSourceType, string> = {
	postgres: "PostgreSQL",
	mysql: "MySQL",
	mariadb: "MariaDB",
	mongo: "MongoDB",
	redis: "Redis",
	libsql: "libSQL",
};
