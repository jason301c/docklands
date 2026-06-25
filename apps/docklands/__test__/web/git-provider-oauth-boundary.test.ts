import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const validateRequestHeaders = vi.hoisted(() => vi.fn());
const assertGitProviderAccess = vi.hoisted(() => vi.fn());
const findGitlabById = vi.hoisted(() => vi.fn());
const updateGitlab = vi.hoisted(() => vi.fn());
const findGiteaById = vi.hoisted(() => vi.fn());
const updateGitea = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/lib/auth", () => ({
	validateRequestHeaders,
}));

vi.mock("@/server/core/services/git-provider", () => ({
	assertGitProviderAccess,
}));

vi.mock("@/server/core/services/gitlab", () => ({
	findGitlabById,
	updateGitlab,
}));

vi.mock("@/server/core/services/gitea", () => ({
	findGiteaById,
	updateGitea,
}));

const { buildOAuthState, verifyOAuthState } = await import(
	"../../server/web/providers/oauth-state"
);
const { handleGitlabAuthorize } = await import(
	"../../server/web/providers/gitlab-authorize"
);
const { handleGitlabCallback } = await import(
	"../../server/web/providers/gitlab-callback"
);
const { handleGiteaAuthorize } = await import(
	"../../server/web/providers/gitea-authorize"
);
const { handleGiteaCallback } = await import(
	"../../server/web/providers/gitea-callback"
);

type SessionResult = {
	user: { id: string } | null;
	session: { activeOrganizationId: string | null } | null;
};

let sessionResult: SessionResult;

const accessDenied = new TRPCError({
	code: "UNAUTHORIZED",
	message: "You don't have access to this Git provider.",
});

const gitlabProvider = () => ({
	gitlabId: "gl-1",
	gitProviderId: "gp-gl",
	applicationId: "gitlab-client",
	secret: "gitlab-secret",
	redirectUri: "https://docklands.test/api/providers/gitlab/callback",
	gitlabUrl: "https://gitlab.example.com",
	gitlabInternalUrl: null,
});

const giteaProvider = () => ({
	giteaId: "gt-1",
	gitProviderId: "gp-gt",
	redirectUri: "https://docklands.test/api/providers/gitea/callback",
	accessToken: null,
	refreshToken: null,
	expiresAt: null,
	giteaUrl: "https://gitea.example.com",
	giteaInternalUrl: null,
	clientId: "gitea-client",
	clientSecret: "gitea-secret",
	gitProvider: {
		name: "Gitea",
		gitProviderId: "gp-gt",
		providerType: "gitea",
		createdAt: "2026-01-01T00:00:00.000Z",
		organizationId: "org-1",
	},
});

const authenticatedAs = (userId = "user-1", organizationId = "org-1") => {
	sessionResult = {
		user: { id: userId },
		session: { activeOrganizationId: organizationId },
	};
};

const unauthenticated = () => {
	sessionResult = { user: null, session: null };
};

const makeRequest = (url: string, cookie?: string, method = "GET"): Request =>
	new Request(url, {
		method,
		headers: cookie ? { cookie } : undefined,
	});

const oauthCookiePair = (cookie: string) => cookie.split(";")[0] ?? "";

const stateFor = (
	kind: "gitlab" | "gitea",
	context = {
		providerId: kind === "gitlab" ? "gl-1" : "gt-1",
		userId: "user-1",
		organizationId: "org-1",
	},
) => buildOAuthState(kind, context);

beforeEach(() => {
	vi.clearAllMocks();
	authenticatedAs();
	validateRequestHeaders.mockImplementation(() =>
		Promise.resolve(sessionResult),
	);
	assertGitProviderAccess.mockResolvedValue(undefined);
	findGitlabById.mockResolvedValue(gitlabProvider());
	updateGitlab.mockResolvedValue(gitlabProvider());
	findGiteaById.mockResolvedValue(giteaProvider());
	updateGitea.mockResolvedValue(giteaProvider());
	fetchMock.mockResolvedValue({
		ok: true,
		json: () =>
			Promise.resolve({
				access_token: "access-token",
				refresh_token: "refresh-token",
				expires_in: 3600,
			}),
		text: () =>
			Promise.resolve(
				JSON.stringify({
					access_token: "access-token",
					refresh_token: "refresh-token",
					expires_in: 3600,
				}),
			),
	});
	vi.stubGlobal("fetch", fetchMock);
});

describe("GitLab OAuth boundary", () => {
	it("requires an authenticated session before starting authorization", async () => {
		unauthenticated();

		const res = await handleGitlabAuthorize(
			makeRequest(
				"https://docklands.test/api/providers/gitlab/authorize?gitlabId=gl-1",
			),
		);

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({
			error: "Authentication required",
		});
		expect(findGitlabById).not.toHaveBeenCalled();
		expect(assertGitProviderAccess).not.toHaveBeenCalled();
	});

	it("binds authorization state to the authenticated user and organization", async () => {
		authenticatedAs("user-bound", "org-bound");

		const res = await handleGitlabAuthorize(
			makeRequest(
				"https://docklands.test/api/providers/gitlab/authorize?gitlabId=gl-1",
			),
		);

		expect(res.status).toBe(307);
		expect(assertGitProviderAccess).toHaveBeenCalledWith(
			{ userId: "user-bound", activeOrganizationId: "org-bound" },
			"gp-gl",
		);

		const location = new URL(res.headers.get("location") ?? "");
		const state = location.searchParams.get("state") ?? "";
		const cookie = oauthCookiePair(res.headers.get("set-cookie") ?? "");
		const callbackRequest = makeRequest(
			"https://docklands.test/callback",
			cookie,
		);

		expect(verifyOAuthState(callbackRequest, "gitlab", state)).toEqual({
			providerId: "gl-1",
			userId: "user-bound",
			organizationId: "org-bound",
		});
	});

	it("rejects a callback when the authenticated session does not match OAuth state", async () => {
		const { state, cookie } = stateFor("gitlab", {
			providerId: "gl-1",
			userId: "user-who-started",
			organizationId: "org-1",
		});
		authenticatedAs("different-user", "org-1");

		const res = await handleGitlabCallback(
			makeRequest(
				`https://docklands.test/api/providers/gitlab/callback?code=code&gitlabId=gl-1&state=${encodeURIComponent(state)}`,
				oauthCookiePair(cookie),
			),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			error: "Invalid or expired OAuth state",
		});
		expect(findGitlabById).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(updateGitlab).not.toHaveBeenCalled();
	});

	it("rechecks provider access at callback before token exchange or persistence", async () => {
		const { state, cookie } = stateFor("gitlab");
		assertGitProviderAccess.mockRejectedValueOnce(accessDenied);

		const res = await handleGitlabCallback(
			makeRequest(
				`https://docklands.test/api/providers/gitlab/callback?code=code&gitlabId=gl-1&state=${encodeURIComponent(state)}`,
				oauthCookiePair(cookie),
			),
		);

		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
		expect(assertGitProviderAccess).toHaveBeenCalledWith(
			{ userId: "user-1", activeOrganizationId: "org-1" },
			"gp-gl",
		);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(updateGitlab).not.toHaveBeenCalled();
	});
});

describe("Gitea OAuth boundary", () => {
	it("requires an authenticated session before starting authorization", async () => {
		unauthenticated();

		const res = await handleGiteaAuthorize(
			makeRequest(
				"https://docklands.test/api/providers/gitea/authorize?giteaId=gt-1",
			),
		);

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({
			error: "Authentication required",
		});
		expect(findGiteaById).not.toHaveBeenCalled();
		expect(assertGitProviderAccess).not.toHaveBeenCalled();
	});

	it("binds authorization state to the authenticated user and organization", async () => {
		authenticatedAs("user-bound", "org-bound");

		const res = await handleGiteaAuthorize(
			makeRequest(
				"https://docklands.test/api/providers/gitea/authorize?giteaId=gt-1",
			),
		);

		expect(res.status).toBe(307);
		expect(assertGitProviderAccess).toHaveBeenCalledWith(
			{ userId: "user-bound", activeOrganizationId: "org-bound" },
			"gp-gt",
		);

		const location = new URL(res.headers.get("location") ?? "");
		const state = location.searchParams.get("state") ?? "";
		const cookie = oauthCookiePair(res.headers.get("set-cookie") ?? "");
		const callbackRequest = makeRequest(
			"https://docklands.test/callback",
			cookie,
		);

		expect(verifyOAuthState(callbackRequest, "gitea", state)).toEqual({
			providerId: "gt-1",
			userId: "user-bound",
			organizationId: "org-bound",
		});
	});

	it("rejects a callback when the authenticated organization does not match OAuth state", async () => {
		const { state, cookie } = stateFor("gitea", {
			providerId: "gt-1",
			userId: "user-1",
			organizationId: "org-who-started",
		});
		authenticatedAs("user-1", "different-org");

		const res = await handleGiteaCallback(
			makeRequest(
				`https://docklands.test/api/providers/gitea/callback?code=code&state=${encodeURIComponent(state)}`,
				oauthCookiePair(cookie),
			),
		);

		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain(
			"error=Invalid%20or%20expired%20OAuth%20state",
		);
		expect(findGiteaById).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(updateGitea).not.toHaveBeenCalled();
	});

	it("rechecks provider access at callback before token exchange or persistence", async () => {
		const { state, cookie } = stateFor("gitea");
		assertGitProviderAccess.mockRejectedValueOnce(accessDenied);

		const res = await handleGiteaCallback(
			makeRequest(
				`https://docklands.test/api/providers/gitea/callback?code=code&state=${encodeURIComponent(state)}`,
				oauthCookiePair(cookie),
			),
		);

		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain("error=Forbidden");
		expect(assertGitProviderAccess).toHaveBeenCalledWith(
			{ userId: "user-1", activeOrganizationId: "org-1" },
			"gp-gt",
		);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(updateGitea).not.toHaveBeenCalled();
	});
});
