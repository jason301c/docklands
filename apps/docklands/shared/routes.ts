import type { WorkspaceServiceType } from "@/shared/workspace-graph";

export type WorkspaceEnvironmentRoute = {
	workspaceId: string;
	environmentId: string;
};

export type WorkspaceServiceRoute = WorkspaceEnvironmentRoute & {
	serviceType: WorkspaceServiceType;
	serviceId: string;
	tab?: string | null;
};

const segment = (value: string) => encodeURIComponent(value);

const tabQuery = (tab?: string | null) =>
	tab ? `?tab=${encodeURIComponent(tab)}` : "";

export const workspaceOverviewPath = "/dashboard/workspace";
export const workspaceListView = "workspaces";
export const workspaceListPath = `${workspaceOverviewPath}?view=${workspaceListView}`;

export function workspaceEnvironmentPath({
	workspaceId,
	environmentId,
}: WorkspaceEnvironmentRoute) {
	return `${workspaceOverviewPath}/${segment(workspaceId)}/${segment(environmentId)}`;
}

export function workspaceServicePath({
	workspaceId,
	environmentId,
	serviceType,
	serviceId,
	tab,
}: WorkspaceServiceRoute) {
	return `${workspaceEnvironmentPath({ workspaceId, environmentId })}/service/${segment(serviceType)}/${segment(serviceId)}${tabQuery(tab)}`;
}

export function isEnvironmentCanvasPath(pathname: string) {
	return /^\/dashboard\/workspace\/[^/]+\/[^/]+\/?$/.test(pathname);
}

export function isWorkspaceDetailPath(pathname: string) {
	return /^\/dashboard\/workspace\/[^/]+\/[^/]+(?:\/.*)?$/.test(pathname);
}
