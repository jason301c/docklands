import { workspaceServicePath } from "@/shared/routes";
import type {
	WorkspaceService,
	WorkspaceServiceType,
} from "@/shared/workspace-graph";
import type {
	ServiceKindFilter,
	ServiceSort,
	ServiceStatusFilter,
} from "./types";

export const deploymentServiceTypes = new Set<WorkspaceServiceType>([
	"application",
	"compose",
]);

export const databaseBackupServiceTypes = new Set<WorkspaceServiceType>([
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
]);

export const databaseCredentialServiceTypes = new Set<WorkspaceServiceType>([
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
	"redis",
]);

export const serviceKindFilterOptions: {
	value: ServiceKindFilter;
	label: string;
}[] = [
	{ value: "all", label: "All types" },
	{ value: "runtimes", label: "Apps & stacks" },
	{ value: "databases", label: "Databases" },
	{ value: "application", label: "Applications" },
	{ value: "compose", label: "Compose" },
	{ value: "postgres", label: "PostgreSQL" },
	{ value: "mysql", label: "MySQL" },
	{ value: "mariadb", label: "MariaDB" },
	{ value: "mongo", label: "MongoDB" },
	{ value: "redis", label: "Redis" },
	{ value: "libsql", label: "LibSQL" },
];

export const serviceStatusFilterOptions: {
	value: ServiceStatusFilter;
	label: string;
}[] = [
	{ value: "all", label: "All statuses" },
	{ value: "running", label: "Running" },
	{ value: "error", label: "Errors" },
	{ value: "done", label: "Done" },
	{ value: "idle", label: "Idle" },
];

export const serviceSortOptions: { value: ServiceSort; label: string }[] = [
	{ value: "manual", label: "Manual layout" },
	{ value: "name-asc", label: "Name" },
	{ value: "type-asc", label: "Type" },
	{ value: "status-asc", label: "Status" },
	{ value: "last-deploy-desc", label: "Recent deployment" },
];

export const getActionInput = (service: WorkspaceService) => {
	switch (service.type) {
		case "application":
			return { applicationId: service.id };
		case "compose":
			return { composeId: service.id };
		default:
			// all managed database engines resolve to the unified database router
			return { databaseId: service.id };
	}
};

export const getDeleteInput = (
	service: WorkspaceService,
	deleteVolumes: boolean,
) => {
	if (service.type === "compose") {
		return { composeId: service.id, deleteVolumes };
	}

	return getActionInput(service);
};

export const getServiceSettingsHref = (
	workspaceId: string,
	environmentId: string,
	service: WorkspaceService,
) =>
	workspaceServicePath({
		workspaceId: workspaceId,
		environmentId,
		serviceType: service.type,
		serviceId: service.id,
	});

export const getDatabaseBackupType = (service: WorkspaceService) =>
	databaseBackupServiceTypes.has(service.type)
		? (service.type as "libsql" | "mariadb" | "mongo" | "mysql" | "postgres")
		: undefined;

export const hasDatabaseCredentials = (service: WorkspaceService) =>
	databaseCredentialServiceTypes.has(service.type);
