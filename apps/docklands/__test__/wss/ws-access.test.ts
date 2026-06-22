import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMember = (role: string) => ({
	id: "member-1",
	role,
	userId: "user-1",
	organizationId: "org-1",
	user: { id: "user-1", email: "test@test.com" },
});

let memberToReturn: ReturnType<typeof mockMember> = mockMember("member");
let organizationRolesToReturn: { permission: string }[] = [];

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			member: {
				findFirst: vi.fn(() => Promise.resolve(memberToReturn)),
			},
			organizationRole: {
				findMany: vi.fn(() => Promise.resolve(organizationRolesToReturn)),
			},
			memberResourceAccess: {
				findMany: vi.fn(() => Promise.resolve([])),
			},
		},
	},
}));

const { canAccessDockerWs, canAccessHostTerminalWs } = await import(
	"../../server/wss/utils"
);

const session = { activeOrganizationId: "org-1" };

beforeEach(() => {
	vi.clearAllMocks();
	organizationRolesToReturn = [];
});

describe("canAccessDockerWs (container log/stat/terminal streams)", () => {
	it("allows owner", async () => {
		memberToReturn = mockMember("owner");
		expect(await canAccessDockerWs({ id: "user-1" }, session)).toBe(true);
	});

	it("allows admin", async () => {
		memberToReturn = mockMember("admin");
		expect(await canAccessDockerWs({ id: "user-1" }, session)).toBe(true);
	});

	it("denies a member without the docker permission", async () => {
		memberToReturn = mockMember("member");
		expect(await canAccessDockerWs({ id: "user-1" }, session)).toBe(false);
	});

	it("allows a member whose custom role grants docker:read", async () => {
		memberToReturn = mockMember("observer");
		organizationRolesToReturn = [
			{ permission: JSON.stringify({ docker: ["read"] }) },
		];
		expect(await canAccessDockerWs({ id: "user-1" }, session)).toBe(true);
	});

	it("denies when the session or user is missing", async () => {
		memberToReturn = mockMember("owner");
		expect(await canAccessDockerWs(null, session)).toBe(false);
		expect(await canAccessDockerWs({ id: "user-1" }, null)).toBe(false);
	});
});

describe("canAccessHostTerminalWs (host/runtime-worker shell)", () => {
	it("allows owner and admin", () => {
		expect(canAccessHostTerminalWs({ id: "u", role: "owner" })).toBe(true);
		expect(canAccessHostTerminalWs({ id: "u", role: "admin" })).toBe(true);
	});

	it("denies members, custom roles, and missing users", () => {
		expect(canAccessHostTerminalWs({ id: "u", role: "member" })).toBe(false);
		expect(canAccessHostTerminalWs({ id: "u", role: "deployer" })).toBe(false);
		expect(canAccessHostTerminalWs(null)).toBe(false);
	});
});
