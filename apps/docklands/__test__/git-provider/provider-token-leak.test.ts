import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S5 regression guard: the `bitbucket.one` and `gitea.one` read procedures must
 * never ship the transparently-decrypted provider secrets to the browser. The
 * underlying `find*ById` service accessors return the full row (secrets decrypted
 * for server-side clone/OAuth flows); the router boundary sanitizes them.
 *
 * We mock the service layer so `find*ById` yields a record that still carries the
 * secret fields, then drive the real router procedures through a server-side
 * caller and assert the response omits every secret while keeping the safe fields.
 */

const findBitbucketById = vi.hoisted(() => vi.fn());
const findGiteaById = vi.hoisted(() => vi.fn());
const assertGitProviderAccess = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/services/bitbucket", () => ({
	findBitbucketById,
	createBitbucket: vi.fn(),
	updateBitbucket: vi.fn(),
}));

vi.mock("@/server/core/services/gitea", () => ({
	findGiteaById,
	createGitea: vi.fn(),
	updateGitea: vi.fn(),
}));

vi.mock("@/server/core/services/git-provider", () => ({
	assertGitProviderAccess,
}));

import { bitbucketRouter } from "@/server/api/routers/bitbucket";
import { giteaRouter } from "@/server/api/routers/gitea";

// Minimal authenticated context: `protectedProcedure` only checks that
// `session` and `user` are present.
const ctx = {
	session: { activeOrganizationId: "org-1", userId: "user-1" },
	user: { id: "user-1", role: "owner" },
	db: {},
	req: { headers: {} },
	res: { headers: new Headers() },
} as any;

const bitbucketCaller = bitbucketRouter.createCaller(ctx);
const giteaCaller = giteaRouter.createCaller(ctx);

describe("provider token leak (S5)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		assertGitProviderAccess.mockResolvedValue(undefined);
	});

	it("bitbucket.one omits the decrypted apiToken but keeps safe fields", async () => {
		findBitbucketById.mockResolvedValue({
			bitbucketId: "bb-1",
			bitbucketUsername: "octo",
			bitbucketEmail: "octo@example.com",
			bitbucketWorkspaceName: "octo-ws",
			apiToken: "super-secret-token",
			gitProviderId: "gp-1",
			gitProvider: {
				gitProviderId: "gp-1",
				name: "BB",
				providerType: "bitbucket",
			},
		});

		const result = await bitbucketCaller.one({ bitbucketId: "bb-1" });

		expect(assertGitProviderAccess).toHaveBeenCalledWith(ctx.session, "gp-1");
		expect(result).not.toHaveProperty("apiToken");
		expect(result).toMatchObject({
			bitbucketId: "bb-1",
			bitbucketUsername: "octo",
			bitbucketEmail: "octo@example.com",
			bitbucketWorkspaceName: "octo-ws",
			gitProviderId: "gp-1",
		});
		expect(result.gitProvider).toMatchObject({ name: "BB" });
	});

	it("gitea.one omits clientSecret/accessToken/refreshToken but keeps safe fields", async () => {
		findGiteaById.mockResolvedValue({
			giteaId: "gt-1",
			giteaUrl: "https://gitea.example.com",
			clientId: "client-id-public",
			clientSecret: "super-secret-client-secret",
			accessToken: "super-secret-access-token",
			refreshToken: "super-secret-refresh-token",
			scopes: "repo",
			gitProviderId: "gp-2",
			gitProvider: { gitProviderId: "gp-2", name: "GT", providerType: "gitea" },
		});

		const result = await giteaCaller.one({ giteaId: "gt-1" });

		expect(assertGitProviderAccess).toHaveBeenCalledWith(ctx.session, "gp-2");
		expect(result).not.toHaveProperty("clientSecret");
		expect(result).not.toHaveProperty("accessToken");
		expect(result).not.toHaveProperty("refreshToken");
		expect(result).toMatchObject({
			giteaId: "gt-1",
			giteaUrl: "https://gitea.example.com",
			clientId: "client-id-public",
			scopes: "repo",
			gitProviderId: "gp-2",
		});
		expect(result.gitProvider).toMatchObject({ name: "GT" });
	});
});
