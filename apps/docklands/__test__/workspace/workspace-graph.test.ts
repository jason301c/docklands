import { describe, expect, it } from "vitest";
import {
	extractWorkspaceServicesFromEnvironment,
	getDefaultWorkspacePosition,
	resolveWorkspaceNodes,
} from "@/shared/workspace-graph";

describe("workspace graph helpers", () => {
	it("normalizes environment services across all deployable types", () => {
		const services = extractWorkspaceServicesFromEnvironment({
			applications: [
				{
					applicationId: "app_1",
					name: "web",
					description: "frontend",
					applicationStatus: "running",
					createdAt: "2026-06-20T00:00:00.000Z",
					serverId: "srv_1",
					server: { name: "worker-a" },
				},
			],
			postgres: [
				{
					postgresId: "pg_1",
					name: "database",
					applicationStatus: "done",
					createdAt: "2026-06-21T00:00:00.000Z",
				},
			],
			compose: [
				{
					composeId: "compose_1",
					name: "stack",
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
			status: "running",
			serverName: "worker-a",
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
});
