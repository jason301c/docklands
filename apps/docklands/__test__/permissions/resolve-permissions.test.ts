import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMemberData = (
	role: string,
	overrides: Record<string, boolean> = {},
) => ({
	id: "member-1",
	role,
	userId: "user-1",
	organizationId: "org-1",
	accessedProjects: [] as string[],
	accessedServices: [] as string[],
	accessedEnvironments: [] as string[],
	canCreateProjects: overrides.canCreateProjects ?? false,
	canDeleteProjects: overrides.canDeleteProjects ?? false,
	canCreateServices: overrides.canCreateServices ?? false,
	canDeleteServices: overrides.canDeleteServices ?? false,
	canCreateEnvironments: overrides.canCreateEnvironments ?? false,
	canDeleteEnvironments: overrides.canDeleteEnvironments ?? false,
	canAccessToTraefikFiles: overrides.canAccessToTraefikFiles ?? false,
	canAccessToDocker: overrides.canAccessToDocker ?? false,
	canAccessToAPI: overrides.canAccessToAPI ?? false,
	canAccessToSSHKeys: overrides.canAccessToSSHKeys ?? false,
	canAccessToGitProviders: overrides.canAccessToGitProviders ?? false,
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
		},
	},
}));

const { resolvePermissions } = await import(
	"@/server/core/services/permission"
);
const { statements } = await import("@/server/core/lib/access-control");

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-1" },
};

beforeEach(() => {
	vi.clearAllMocks();
	memberToReturn = mockMemberData("member");
	organizationRolesToReturn = [];
});

describe("static roles", () => {
	it("owner gets every declared permission", async () => {
		memberToReturn = mockMemberData("owner");
		const perms = await resolvePermissions(ctx);

		for (const [resource, actions] of Object.entries(statements)) {
			for (const action of actions) {
				expect((perms as any)[resource][action]).toBe(true);
			}
		}
	});

	it("admin gets every declared permission except organization.delete", async () => {
		memberToReturn = mockMemberData("admin");
		const perms = await resolvePermissions(ctx);

		for (const [resource, actions] of Object.entries(statements)) {
			for (const action of actions) {
				const expected =
					resource === "organization" && action === "delete" ? false : true;
				expect((perms as any)[resource][action]).toBe(expected);
			}
		}
	});

	it("member gets service-scoped defaults but not org administration", async () => {
		const perms = await resolvePermissions(ctx);

		expect(perms.service.read).toBe(true);
		expect(perms.deployment.read).toBe(true);
		expect(perms.domain.read).toBe(true);
		expect(perms.logs.read).toBe(true);
		expect(perms.monitoring.read).toBe(true);
		expect(perms.server.read).toBe(false);
		expect(perms.registry.read).toBe(false);
		expect(perms.certificate.read).toBe(false);
		expect(perms.destination.read).toBe(false);
		expect(perms.notification.read).toBe(false);
		expect(perms.auditLog.read).toBe(false);
	});
});

describe("member permission flags", () => {
	it("member gets project.create=false without a permission flag", async () => {
		const perms = await resolvePermissions(ctx);
		expect(perms.project.create).toBe(false);
	});

	it("member gets project.create=true with canCreateProjects", async () => {
		memberToReturn = mockMemberData("member", { canCreateProjects: true });
		const perms = await resolvePermissions(ctx);
		expect(perms.project.create).toBe(true);
	});

	it("member gets docker.read=true with canAccessToDocker", async () => {
		memberToReturn = mockMemberData("member", { canAccessToDocker: true });
		const perms = await resolvePermissions(ctx);
		expect(perms.docker.read).toBe(true);
	});
});

describe("custom roles", () => {
	it("resolves organization-defined permissions without a license gate", async () => {
		memberToReturn = mockMemberData("ops");
		organizationRolesToReturn = [
			{
				permission: JSON.stringify({
					server: ["read"],
					registry: ["create"],
				}),
			},
		];

		const perms = await resolvePermissions(ctx);

		expect(perms.server.read).toBe(true);
		expect(perms.registry.create).toBe(true);
		expect(perms.project.create).toBe(false);
	});
});
