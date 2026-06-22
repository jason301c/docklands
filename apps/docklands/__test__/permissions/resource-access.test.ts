import { beforeEach, describe, expect, it, vi } from "vitest";

// Rows returned from the normalized member_resource_access table.
let accessRows: { resourceType: string; resourceId: string }[] = [];

const findManyMock = vi.fn(() => Promise.resolve(accessRows));

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			memberResourceAccess: {
				findMany: findManyMock,
			},
		},
	},
}));

const { loadResourceAccess } = await import(
	"@/server/core/services/permission"
);

beforeEach(() => {
	vi.clearAllMocks();
	accessRows = [];
});

describe("loadResourceAccess", () => {
	it("projects normalized rows back into the legacy array shape", async () => {
		accessRows = [
			{ resourceType: "workspace", resourceId: "ws-1" },
			{ resourceType: "workspace", resourceId: "ws-2" },
			{ resourceType: "service", resourceId: "svc-1" },
			{ resourceType: "environment", resourceId: "env-1" },
			{ resourceType: "gitProvider", resourceId: "gp-1" },
			{ resourceType: "runtimeWorker", resourceId: "rw-1" },
		];
		const lists = await loadResourceAccess("member-1");
		expect(lists.accessedWorkspaces).toEqual(["ws-1", "ws-2"]);
		expect(lists.accessedServices).toEqual(["svc-1"]);
		expect(lists.accessedEnvironments).toEqual(["env-1"]);
		expect(lists.accessedGitProviders).toEqual(["gp-1"]);
		expect(lists.accessedRuntimeWorkers).toEqual(["rw-1"]);
	});

	it("returns empty arrays for a member with no grants", async () => {
		accessRows = [];
		const lists = await loadResourceAccess("member-1");
		expect(lists).toEqual({
			accessedWorkspaces: [],
			accessedEnvironments: [],
			accessedServices: [],
			accessedGitProviders: [],
			accessedRuntimeWorkers: [],
		});
	});

	it("ignores unknown resource types", async () => {
		accessRows = [
			{ resourceType: "service", resourceId: "svc-1" },
			{ resourceType: "mystery", resourceId: "x-1" },
		];
		const lists = await loadResourceAccess("member-1");
		expect(lists.accessedServices).toEqual(["svc-1"]);
	});
});
