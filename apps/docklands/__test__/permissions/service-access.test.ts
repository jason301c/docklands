import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMemberData = (role: string) => ({
	id: "member-1",
	role,
	userId: "user-1",
	organizationId: "org-1",
	user: { id: "user-1", email: "test@test.com" },
});

let memberToReturn: ReturnType<typeof mockMemberData> =
	mockMemberData("member");

// Rows from the normalized member_resource_access table.
let resourceAccessRows: { resourceType: string; resourceId: string }[] = [];

const grant = (
	accessedServices: string[] = [],
	accessedWorkspaces: string[] = [],
) => {
	resourceAccessRows = [
		...accessedServices.map((resourceId) => ({
			resourceType: "service",
			resourceId,
		})),
		...accessedWorkspaces.map((resourceId) => ({
			resourceType: "workspace",
			resourceId,
		})),
	];
};

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			member: {
				findFirst: vi.fn(() => Promise.resolve(memberToReturn)),
				findMany: vi.fn(() => Promise.resolve([])),
			},
			organizationRole: {
				findFirst: vi.fn(),
				findMany: vi.fn(() => Promise.resolve([])),
			},
			memberResourceAccess: {
				findMany: vi.fn(() => Promise.resolve(resourceAccessRows)),
			},
		},
	},
}));

const { checkServicePermissionAndAccess, checkServiceAccess } = await import(
	"@/server/core/services/permission"
);

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-1" },
};

beforeEach(() => {
	vi.clearAllMocks();
	resourceAccessRows = [];
});

describe("checkServicePermissionAndAccess", () => {
	it("owner bypasses the resource-access check", async () => {
		memberToReturn = mockMemberData("owner");
		grant([]);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).resolves.toBeUndefined();
	});

	it("admin bypasses the resource-access check", async () => {
		memberToReturn = mockMemberData("admin");
		grant([]);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				backup: ["create"],
			}),
		).resolves.toBeUndefined();
	});

	it("member with access to service passes", async () => {
		memberToReturn = mockMemberData("member");
		grant(["service-123"]);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).resolves.toBeUndefined();
	});

	it("member WITHOUT access to service fails", async () => {
		memberToReturn = mockMemberData("member");
		grant(["other-service"]);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				deployment: ["read"],
			}),
		).rejects.toThrow("You don't have access to this service");
	});

	it("member with no granted access fails", async () => {
		memberToReturn = mockMemberData("member");
		grant([]);
		await expect(
			checkServicePermissionAndAccess(ctx, "service-123", {
				domain: ["delete"],
			}),
		).rejects.toThrow("You don't have access to this service");
	});
});

describe("checkServiceAccess", () => {
	it("member with service access passes read check", async () => {
		memberToReturn = mockMemberData("member");
		grant(["app-1"]);
		await expect(
			checkServiceAccess(ctx, "app-1", "read"),
		).resolves.toBeUndefined();
	});

	it("member without service access fails read check", async () => {
		memberToReturn = mockMemberData("member");
		grant([]);
		await expect(checkServiceAccess(ctx, "app-1", "read")).rejects.toThrow(
			"You don't have access to this service",
		);
	});

	it("owner bypasses all access checks", async () => {
		memberToReturn = mockMemberData("owner");
		grant([], []);
		await expect(
			checkServiceAccess(ctx, "workspace-1", "create"),
		).resolves.toBeUndefined();
	});
});
