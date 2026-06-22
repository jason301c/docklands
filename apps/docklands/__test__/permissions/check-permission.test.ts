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

let organizationRolesToReturn: { permission: string }[] = [];

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			member: {
				findFirst: vi.fn(() => Promise.resolve(memberToReturn)),
				findMany: vi.fn(() => Promise.resolve([])),
			},
			organizationRole: {
				findFirst: vi.fn(),
				findMany: vi.fn(() => Promise.resolve(organizationRolesToReturn)),
			},
			memberResourceAccess: {
				findMany: vi.fn(() => Promise.resolve([])),
			},
		},
	},
}));

const { checkPermission } = await import("@/server/core/services/permission");

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-1" },
};

beforeEach(() => {
	vi.clearAllMocks();
	organizationRolesToReturn = [];
});

describe("owner and admin static permissions", () => {
	it("owner bypasses deployment.read", async () => {
		memberToReturn = mockMemberData("owner");
		await expect(
			checkPermission(ctx, { deployment: ["read"] }),
		).resolves.toBeUndefined();
	});

	it("admin bypasses backup.create", async () => {
		memberToReturn = mockMemberData("admin");
		await expect(
			checkPermission(ctx, { backup: ["create"] }),
		).resolves.toBeUndefined();
	});

	it("owner allows multiple advanced permissions at once", async () => {
		memberToReturn = mockMemberData("owner");
		await expect(
			checkPermission(ctx, {
				deployment: ["read"],
				backup: ["create"],
				domain: ["delete"],
			}),
		).resolves.toBeUndefined();
	});
});

describe("member is denied org-level advanced resources", () => {
	it("member is denied registry.read", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { registry: ["read"] }),
		).rejects.toThrow();
	});

	it("member is denied certificate.read", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { certificate: ["read"] }),
		).rejects.toThrow();
	});

	it("member is denied destination.read", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { destination: ["read"] }),
		).rejects.toThrow();
	});

	it("member is denied notification.read", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { notification: ["read"] }),
		).rejects.toThrow();
	});

	it("member is denied auditLog.read", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { auditLog: ["read"] }),
		).rejects.toThrow();
	});

	it("member is denied runtimeWorker.read", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { runtimeWorker: ["read"] }),
		).rejects.toThrow();
	});

	it("member is denied registry.create", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { registry: ["create"] }),
		).rejects.toThrow();
	});
});

describe("static roles validate free-tier resources", () => {
	it("owner passes workspace.create", async () => {
		memberToReturn = mockMemberData("owner");
		await expect(
			checkPermission(ctx, { workspace: ["create"] }),
		).resolves.toBeUndefined();
	});

	it("member fails workspace.create without the member permission flag", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { workspace: ["create"] }),
		).rejects.toThrow();
	});

	it("member passes service.read", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { service: ["read"] }),
		).resolves.toBeUndefined();
	});

	it("member fails service.create", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { service: ["create"] }),
		).rejects.toThrow();
	});
});

describe("base member role has no elevated capabilities", () => {
	// Legacy per-member boolean flags were removed; capabilities now come only
	// from the role (static or custom). A plain member cannot create or reach
	// privileged resources without a granting role.
	it("member cannot create workspaces", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { workspace: ["create"] }),
		).rejects.toThrow();
	});

	it("member cannot read docker", async () => {
		memberToReturn = mockMemberData("member");
		await expect(checkPermission(ctx, { docker: ["read"] })).rejects.toThrow();
	});

	it("member can still read services (static member default)", async () => {
		memberToReturn = mockMemberData("member");
		await expect(
			checkPermission(ctx, { service: ["read"] }),
		).resolves.toBeUndefined();
	});
});

describe("custom roles (organization_role)", () => {
	it("authorizes exactly the granted resource/action", async () => {
		memberToReturn = mockMemberData("deployer");
		organizationRolesToReturn = [
			{ permission: JSON.stringify({ registry: ["read"] }) },
		];
		await expect(
			checkPermission(ctx, { registry: ["read"] }),
		).resolves.toBeUndefined();
	});

	it("denies an action the custom role was not granted", async () => {
		memberToReturn = mockMemberData("deployer");
		organizationRolesToReturn = [
			{ permission: JSON.stringify({ registry: ["read"] }) },
		];
		await expect(
			checkPermission(ctx, { registry: ["create"] }),
		).rejects.toThrow();
	});

	it("merges permissions across multiple rows for the same role", async () => {
		memberToReturn = mockMemberData("deployer");
		organizationRolesToReturn = [
			{ permission: JSON.stringify({ registry: ["read"] }) },
			{ permission: JSON.stringify({ certificate: ["read", "create"] }) },
		];
		await expect(
			checkPermission(ctx, { registry: ["read"], certificate: ["create"] }),
		).resolves.toBeUndefined();
	});

	it("grants only what the custom role declares, nothing more", async () => {
		// The role grants registry:read but not docker:read, so docker is denied.
		memberToReturn = mockMemberData("deployer");
		organizationRolesToReturn = [
			{ permission: JSON.stringify({ registry: ["read"] }) },
		];
		await expect(checkPermission(ctx, { docker: ["read"] })).rejects.toThrow();
	});

	it("rejects when the custom role has no backing rows", async () => {
		memberToReturn = mockMemberData("ghost-role");
		organizationRolesToReturn = [];
		await expect(checkPermission(ctx, { service: ["read"] })).rejects.toThrow();
	});
});
