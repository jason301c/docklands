import type { RouterOutputs } from "@/client/api/trpc";
import type {
	WorkspaceService,
	WorkspaceServiceType,
} from "@/shared/workspace-graph";

export type WorkspaceData = RouterOutputs["workspaceGraph"]["byEnvironment"];
export type WorkspaceConnection = WorkspaceData["connections"][number];

export type SelectedServiceRef = {
	serviceId: string;
	serviceType: WorkspaceServiceType;
};

export type CreateServiceDialog =
	| "application"
	| "database"
	| "compose"
	| "template"
	| "import";

export type CreateDatabaseType =
	| "libsql"
	| "mariadb"
	| "mongo"
	| "mysql"
	| "postgres"
	| "redis";

export type ServiceKindFilter =
	| "all"
	| "runtimes"
	| "databases"
	| WorkspaceServiceType;
export type ServiceStatusFilter =
	| "all"
	| NonNullable<WorkspaceService["status"]>;
export type ServiceSort =
	| "manual"
	| "name-asc"
	| "type-asc"
	| "status-asc"
	| "last-deploy-desc";
