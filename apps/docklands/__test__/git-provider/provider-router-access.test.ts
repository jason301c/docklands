import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assertGitProviderAccess = vi.hoisted(() => vi.fn());
const getAccessibleGitProviderIds = vi.hoisted(() => vi.fn());
const updateGitProvider = vi.hoisted(() => vi.fn());

const findGithubById = vi.hoisted(() => vi.fn());
const findGitlabById = vi.hoisted(() => vi.fn());
const findGiteaById = vi.hoisted(() => vi.fn());
const findBitbucketById = vi.hoisted(() => vi.fn());

const getGithubRepositories = vi.hoisted(() => vi.fn());
const getGitlabBranches = vi.hoisted(() => vi.fn());
const testGiteaConnection = vi.hoisted(() => vi.fn());
const getBitbucketRepositories = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			github: { findMany: vi.fn() },
			gitlab: { findMany: vi.fn() },
			gitea: { findMany: vi.fn() },
			bitbucket: { findMany: vi.fn() },
		},
	},
}));

vi.mock("@/server/core/lib/auth", () => ({
	validateRequest: vi.fn(),
	validateRequestHeaders: vi.fn(),
}));

vi.mock("@/server/core/services/git-provider", () => ({
	assertGitProviderAccess,
	getAccessibleGitProviderIds,
	updateGitProvider,
}));

vi.mock("@/server/core/services/github", () => ({
	findGithubById,
	updateGithub: vi.fn(),
}));

vi.mock("@/server/core/services/gitlab", () => ({
	createGitlab: vi.fn(),
	findGitlabById,
	updateGitlab: vi.fn(),
}));

vi.mock("@/server/core/services/gitea", () => ({
	createGitea: vi.fn(),
	findGiteaById,
	updateGitea: vi.fn(),
}));

vi.mock("@/server/core/services/bitbucket", () => ({
	createBitbucket: vi.fn(),
	findBitbucketById,
	updateBitbucket: vi.fn(),
}));

vi.mock("@/server/core/utils/providers/github", () => ({
	getGithubBranches: vi.fn(),
	getGithubRepositories,
	haveGithubRequirements: vi.fn(() => true),
}));

vi.mock("@/server/core/utils/providers/gitlab", () => ({
	getGitlabBranches,
	getGitlabRepositories: vi.fn(),
	haveGitlabRequirements: vi.fn(() => true),
	testGitlabConnection: vi.fn(),
}));

vi.mock("@/server/core/utils/providers/gitea", () => ({
	getGiteaBranches: vi.fn(),
	getGiteaRepositories: vi.fn(),
	haveGiteaRequirements: vi.fn(() => true),
	testGiteaConnection,
}));

vi.mock("@/server/core/utils/providers/bitbucket", () => ({
	getBitbucketBranches: vi.fn(),
	getBitbucketRepositories,
	testBitbucketConnection: vi.fn(),
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit: vi.fn(),
}));

import { bitbucketRouter } from "@/server/api/routers/bitbucket";
import { giteaRouter } from "@/server/api/routers/gitea";
import { githubRouter } from "@/server/api/routers/github";
import { gitlabRouter } from "@/server/api/routers/gitlab";

const ctx = {
	session: { activeOrganizationId: "org-1", userId: "user-member" },
	user: { id: "user-member", role: "member" },
	db: {},
	req: { headers: {} },
	res: { headers: new Headers() },
} as any;

const accessDenied = new TRPCError({
	code: "UNAUTHORIZED",
	message: "You don't have access to this Git provider.",
});

describe("provider router access guards", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		assertGitProviderAccess.mockResolvedValue(undefined);
		getAccessibleGitProviderIds.mockResolvedValue(new Set());
		updateGitProvider.mockResolvedValue(undefined);
		findGithubById.mockResolvedValue({
			githubId: "gh-1",
			gitProviderId: "gp-gh",
		});
		findGitlabById.mockResolvedValue({
			gitlabId: "gl-1",
			gitProviderId: "gp-gl",
		});
		findGiteaById.mockResolvedValue({
			giteaId: "gt-1",
			gitProviderId: "gp-gt",
		});
		findBitbucketById.mockResolvedValue({
			bitbucketId: "bb-1",
			gitProviderId: "gp-bb",
		});
		getGithubRepositories.mockResolvedValue([]);
		getGitlabBranches.mockResolvedValue([]);
		testGiteaConnection.mockResolvedValue(0);
		getBitbucketRepositories.mockResolvedValue([]);
	});

	it("blocks GitHub repository enumeration when provider access is denied", async () => {
		assertGitProviderAccess.mockRejectedValueOnce(accessDenied);

		await expect(
			githubRouter
				.createCaller(ctx)
				.getGithubRepositories({ githubId: "gh-1" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });

		expect(assertGitProviderAccess).toHaveBeenCalledWith(ctx.session, "gp-gh");
		expect(getGithubRepositories).not.toHaveBeenCalled();
	});

	it("blocks GitLab branch enumeration when provider access is denied", async () => {
		assertGitProviderAccess.mockRejectedValueOnce(accessDenied);

		await expect(
			gitlabRouter.createCaller(ctx).getGitlabBranches({
				gitlabId: "gl-1",
				id: 123,
				owner: "team",
				repo: "app",
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });

		expect(assertGitProviderAccess).toHaveBeenCalledWith(ctx.session, "gp-gl");
		expect(getGitlabBranches).not.toHaveBeenCalled();
	});

	it("blocks Gitea connection tests when provider access is denied", async () => {
		assertGitProviderAccess.mockRejectedValueOnce(accessDenied);

		await expect(
			giteaRouter
				.createCaller(ctx)
				.testConnection({ giteaId: "gt-1", organizationName: "team" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });

		expect(assertGitProviderAccess).toHaveBeenCalledWith(ctx.session, "gp-gt");
		expect(testGiteaConnection).not.toHaveBeenCalled();
	});

	it("blocks Bitbucket repository enumeration when provider access is denied", async () => {
		assertGitProviderAccess.mockRejectedValueOnce(accessDenied);

		await expect(
			bitbucketRouter
				.createCaller(ctx)
				.getBitbucketRepositories({ bitbucketId: "bb-1" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });

		expect(assertGitProviderAccess).toHaveBeenCalledWith(ctx.session, "gp-bb");
		expect(getBitbucketRepositories).not.toHaveBeenCalled();
	});
});
