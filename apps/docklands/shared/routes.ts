import { siteConfig } from "@/shared/site";
import type { WorkspaceServiceType } from "@/shared/workspace-graph";

/**
 * Canonical external links, re-exported from the central `siteConfig` so the
 * project's docs/source URLs live in one place instead of being copy-pasted
 * (the audit found the personal fork URL hardcoded across ~7 components).
 * Rebranding or moving orgs is a single edit in `shared/site.ts`.
 */
export const DOCS_URL = siteConfig.links.docs;
export const GITHUB_REPO_URL = siteConfig.links.github;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const SUPPORT_URL = siteConfig.links.support;

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
