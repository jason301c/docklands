import { describe, expect, it } from "vitest";
import {
	canWorkspaceServiceExposeVariables,
	countWorkspaceTopology,
	extractWorkspaceServicesFromEnvironment,
	getDefaultWorkspacePosition,
	normalizeWorkspaceConnectionEndpoints,
	resolveWorkspaceConnectionGroups,
	resolveWorkspaceNodes,
} from "@/shared/workspace-graph";

describe("workspace graph helpers", () => {
	it("normalizes environment services across all deployable types", () => {
		const services = extractWorkspaceServicesFromEnvironment({
			applications: [
				{
					applicationId: "app_1",
					name: "web",
					appName: "docklands-web-abc123",
					description: "frontend",
					applicationStatus: "running",
					createdAt: "2026-06-20T00:00:00.000Z",
					runtimeWorkerId: "srv_1",
					refreshToken: "app_refresh_token",
					deployments: [
						{
							createdAt: "2026-06-20T02:00:00.000Z",
							startedAt: "2026-06-20T02:01:00.000Z",
							finishedAt: "2026-06-20T02:03:00.000Z",
						},
						{
							createdAt: "2026-06-20T01:00:00.000Z",
							startedAt: "2026-06-20T01:01:00.000Z",
						},
					],
				},
			],
			database: [
				{
					databaseId: "pg_1",
					engine: "postgres",
					name: "database",
					applicationStatus: "done",
					createdAt: "2026-06-21T00:00:00.000Z",
				},
			],
			compose: [
				{
					composeId: "compose_1",
					name: "stack",
					appName: "docklands-stack-def456",
					composeType: "stack",
					refreshToken: "compose_refresh_token",
					composeStatus: "idle",
					createdAt: "2026-06-19T00:00:00.000Z",
				},
			],
		});

		expect(services.map((service) => service.id)).toEqual([
			"pg_1",
			"app_1",
			"compose_1",
		]);
		expect(services[1]).toMatchObject({
			id: "app_1",
			type: "application",
			name: "web",
			appName: "docklands-web-abc123",
			refreshToken: "app_refresh_token",
			status: "running",
			lastDeployAt: "2026-06-20T02:03:00.000Z",
		});
		expect(services[2]).toMatchObject({
			id: "compose_1",
			type: "compose",
			appName: "docklands-stack-def456",
			composeType: "stack",
			refreshToken: "compose_refresh_token",
		});
	});

	it("lays services out predictably when no persisted positions exist", () => {
		expect(getDefaultWorkspacePosition(0)).toMatchObject({ x: 80, y: 80 });
		expect(getDefaultWorkspacePosition(1)).toMatchObject({ x: 480, y: 80 });
		expect(getDefaultWorkspacePosition(3)).toMatchObject({ x: 80, y: 340 });
	});

	it("uses persisted positions without losing new services", () => {
		const nodes = resolveWorkspaceNodes(
			[
				{ id: "app_1", type: "application", name: "web" },
				{ id: "pg_1", type: "postgres", name: "database" },
			],
			[
				{
					serviceId: "app_1",
					serviceType: "application",
					x: 900,
					y: 120,
					width: 320,
					height: 180,
				},
			],
		);

		expect(nodes[0]).toMatchObject({
			serviceId: "app_1",
			serviceType: "application",
			x: 900,
			y: 120,
			width: 320,
			height: 180,
		});
		expect(nodes[1]).toMatchObject({
			serviceId: "pg_1",
			serviceType: "postgres",
			x: 480,
			y: 80,
		});
	});

	it("identifies services that can expose generated connection variables", () => {
		expect(canWorkspaceServiceExposeVariables("postgres")).toBe(true);
		expect(canWorkspaceServiceExposeVariables("redis")).toBe(true);
		expect(canWorkspaceServiceExposeVariables("application")).toBe(false);
		expect(canWorkspaceServiceExposeVariables("compose")).toBe(false);
	});

	it("normalizes connection direction toward variable sources", () => {
		const app = { serviceId: "app_1", serviceType: "application" as const };
		const database = { serviceId: "pg_1", serviceType: "postgres" as const };

		expect(normalizeWorkspaceConnectionEndpoints(app, database)).toEqual({
			source: database,
			target: app,
			flipped: true,
		});
		expect(normalizeWorkspaceConnectionEndpoints(database, app)).toEqual({
			source: database,
			target: app,
			flipped: false,
		});
	});

	it("groups connected workspace nodes into visual bounds", () => {
		const nodes = [
			{
				serviceId: "app_1",
				serviceType: "application" as const,
				x: 100,
				y: 120,
				width: 280,
				height: 164,
			},
			{
				serviceId: "pg_1",
				serviceType: "postgres" as const,
				x: 520,
				y: 160,
				width: 280,
				height: 164,
			},
			{
				serviceId: "redis_1",
				serviceType: "redis" as const,
				x: 520,
				y: 420,
				width: 280,
				height: 164,
			},
			{
				serviceId: "worker_1",
				serviceType: "application" as const,
				x: 1000,
				y: 120,
				width: 280,
				height: 164,
			},
		];

		const groups = resolveWorkspaceConnectionGroups(nodes, [
			{
				sourceServiceId: "pg_1",
				sourceServiceType: "postgres",
				targetServiceId: "app_1",
				targetServiceType: "application",
			},
			{
				sourceServiceId: "redis_1",
				sourceServiceType: "redis",
				targetServiceId: "app_1",
				targetServiceType: "application",
			},
			{
				sourceServiceId: "missing",
				sourceServiceType: "postgres",
				targetServiceId: "worker_1",
				targetServiceType: "application",
			},
		]);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.nodeKeys).toEqual([
			"application:app_1",
			"postgres:pg_1",
			"redis:redis_1",
		]);
		expect(groups[0]).toMatchObject({
			x: 52,
			y: 72,
			width: 796,
			height: 560,
		});
	});

	it("keeps independent connection groups separate and sorted by canvas position", () => {
		const nodes = [
			{
				serviceId: "api",
				serviceType: "application" as const,
				x: 640,
				y: 420,
				width: 280,
				height: 164,
			},
			{
				serviceId: "api_db",
				serviceType: "postgres" as const,
				x: 980,
				y: 420,
				width: 280,
				height: 164,
			},
			{
				serviceId: "web",
				serviceType: "application" as const,
				x: 100,
				y: 80,
				width: 280,
				height: 164,
			},
			{
				serviceId: "web_cache",
				serviceType: "redis" as const,
				x: 440,
				y: 80,
				width: 280,
				height: 164,
			},
			{
				serviceId: "orphan",
				serviceType: "mysql" as const,
				x: 1320,
				y: 80,
				width: 280,
				height: 164,
			},
		];

		const groups = resolveWorkspaceConnectionGroups(
			nodes,
			[
				{
					sourceServiceId: "api_db",
					sourceServiceType: "postgres",
					targetServiceId: "api",
					targetServiceType: "application",
				},
				{
					sourceServiceId: "web_cache",
					sourceServiceType: "redis",
					targetServiceId: "web",
					targetServiceType: "application",
				},
			],
			32,
		);

		expect(groups).toHaveLength(2);
		expect(groups.map((group) => group.nodeKeys)).toEqual([
			["application:web", "redis:web_cache"],
			["application:api", "postgres:api_db"],
		]);
		expect(groups[0]).toMatchObject({
			x: 68,
			y: 48,
			width: 684,
			height: 228,
		});
		expect(groups[1]).toMatchObject({
			x: 608,
			y: 388,
			width: 684,
			height: 228,
		});
	});

	it("counts topology health and unlinked services", () => {
		const counts = countWorkspaceTopology(
			[
				{
					id: "web",
					type: "application",
					name: "web",
					status: "running",
				},
				{
					id: "api",
					type: "application",
					name: "api",
					status: "error",
				},
				{
					id: "db",
					type: "postgres",
					name: "database",
					status: "done",
				},
			],
			[
				{
					sourceServiceId: "db",
					sourceServiceType: "postgres",
					targetServiceId: "api",
					targetServiceType: "application",
				},
			],
		);

		expect(counts).toEqual({
			services: 3,
			running: 1,
			errors: 1,
			connections: 1,
			unlinked: 1,
		});
	});
});
