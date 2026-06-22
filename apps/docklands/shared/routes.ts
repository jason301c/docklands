import type { WorkspaceServiceType } from "@/shared/workspace-graph";

export type WorkspaceEnvironmentRoute = {
	projectId: string;
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
export const projectsPath = "/dashboard/projects";

export function workspaceEnvironmentPath({
	projectId,
	environmentId,
}: WorkspaceEnvironmentRoute) {
	return `${workspaceOverviewPath}/${segment(projectId)}/${segment(environmentId)}`;
}

export function workspaceServicePath({
	projectId,
	environmentId,
	serviceType,
	serviceId,
	tab,
}: WorkspaceServiceRoute) {
	return `${workspaceEnvironmentPath({ projectId, environmentId })}/service/${segment(serviceType)}/${segment(serviceId)}${tabQuery(tab)}`;
}

export function legacyEnvironmentPath({
	projectId,
	environmentId,
}: WorkspaceEnvironmentRoute) {
	return `/dashboard/project/${segment(projectId)}/environment/${segment(environmentId)}`;
}

export function legacyServicePath({
	projectId,
	environmentId,
	serviceType,
	serviceId,
	tab,
}: WorkspaceServiceRoute) {
	return `${legacyEnvironmentPath({ projectId, environmentId })}/services/${segment(serviceType)}/${segment(serviceId)}${tabQuery(tab)}`;
}

export function isEnvironmentCanvasPath(pathname: string) {
	return /^\/dashboard\/(?:workspace|project)\/[^/]+\/(?:environment\/)?[^/]+\/?$/.test(
		pathname,
	);
}

export function isWorkspaceDetailPath(pathname: string) {
	return (
		/^\/dashboard\/workspace\/[^/]+\/[^/]+(?:\/.*)?$/.test(pathname) ||
		/^\/dashboard\/project\/[^/]+\/environment\/[^/]+(?:\/.*)?$/.test(pathname)
	);
}
