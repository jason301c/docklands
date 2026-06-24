import type { WorkspaceServiceType } from "@/shared/workspace-graph";

export const serviceTypeLabels: Record<WorkspaceServiceType, string> = {
	application: "Application",
	compose: "Compose",
	libsql: "LibSQL",
	mariadb: "MariaDB",
	mongo: "MongoDB",
	mysql: "MySQL",
	postgres: "PostgreSQL",
	redis: "Redis",
};
