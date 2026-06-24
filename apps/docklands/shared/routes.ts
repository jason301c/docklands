import type { WorkspaceServiceType } from "@/shared/workspace-graph";

/**
 * Canonical external links. Centralized here so the project's docs/source URLs
 * live in one place instead of being copy-pasted (the audit found the personal
 * fork URL hardcoded across ~7 components); rebranding or moving orgs is then a
 * single edit.
 */
export const DOCS_URL = "https://docs.docklands.dev";
export const GITHUB_REPO_URL = "https://github.com/jason301c/docklands";
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const SUPPORT_URL = "https://discord.gg/2tBnJ3jDJc";

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
