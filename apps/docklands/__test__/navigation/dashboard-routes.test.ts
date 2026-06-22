import { describe, expect, it } from "vitest";
import {
	isEnvironmentCanvasPath,
	isWorkspaceDetailPath,
	legacyEnvironmentPath,
	legacyServicePath,
	projectsPath,
	workspaceEnvironmentPath,
	workspaceOverviewPath,
	workspaceServicePath,
} from "@/shared/routes";

describe("dashboard route helpers", () => {
	it("builds canonical canvas-first workspace paths", () => {
		expect(workspaceOverviewPath).toBe("/dashboard/workspace");
		expect(projectsPath).toBe("/dashboard/projects");
		expect(
			workspaceEnvironmentPath({
				projectId: "project_1",
				environmentId: "env_1",
			}),
		).toBe("/dashboard/workspace/project_1/env_1");
		expect(
			workspaceServicePath({
				projectId: "project_1",
				environmentId: "env_1",
				serviceType: "application",
				serviceId: "app_1",
				tab: "deployments",
			}),
		).toBe(
			"/dashboard/workspace/project_1/env_1/service/application/app_1?tab=deployments",
		);
	});

	it("keeps legacy project paths available for compatibility", () => {
		expect(
			legacyEnvironmentPath({
				projectId: "project_1",
				environmentId: "env_1",
			}),
		).toBe("/dashboard/project/project_1/environment/env_1");
		expect(
			legacyServicePath({
				projectId: "project_1",
				environmentId: "env_1",
				serviceType: "compose",
				serviceId: "compose_1",
			}),
		).toBe(
			"/dashboard/project/project_1/environment/env_1/services/compose/compose_1",
		);
	});

	it("recognizes canonical and compatibility canvas routes", () => {
		expect(
			isEnvironmentCanvasPath("/dashboard/workspace/project_1/env_1"),
		).toBe(true);
		expect(
			isEnvironmentCanvasPath("/dashboard/project/project_1/environment/env_1"),
		).toBe(true);
		expect(
			isEnvironmentCanvasPath(
				"/dashboard/workspace/project_1/env_1/service/application/app_1",
			),
		).toBe(false);
	});

	it("recognizes workspace detail routes that own their own header", () => {
		expect(isWorkspaceDetailPath("/dashboard/workspace/project_1/env_1")).toBe(
			true,
		);
		expect(
			isWorkspaceDetailPath(
				"/dashboard/workspace/project_1/env_1/service/application/app_1",
			),
		).toBe(true);
		expect(
			isWorkspaceDetailPath(
				"/dashboard/project/project_1/environment/env_1/services/application/app_1",
			),
		).toBe(true);
		expect(isWorkspaceDetailPath("/dashboard/workspace")).toBe(false);
	});
});
