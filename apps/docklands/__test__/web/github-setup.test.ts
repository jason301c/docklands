import { readFileSync } from "node:fs";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Auth boundary for the GitHub App setup callback
 * (`server/web/providers/github-setup.ts`).
 *
 * GitHub redirects the user's browser to this callback to create/bind a Git
 * provider (which holds app credentials), so it MUST require an authenticated
 * session and scope the provider to the caller's own org — never trusting the
 * org/user ids that used to be carried in `state`. We assert:
 *   - an unauthenticated request is rejected (401) and creates no provider;
 *   - missing/tampered setup state is rejected before side effects;
 *   - gh_setup binding a provider in a different org is rejected (403);
 *   - gh_setup verifies the installation before storing it;
 *   - gh_init derives org/user from the authenticated session.
 *
 * All side-effecting deps are mocked: the auth validator (per-test session), the
 * github service (createGithub / findGithubById), the db update chain, and the
 * Octokit manifest conversion used by the gh_init happy path.
 */

// --- auth: validateRequestHeaders returns whatever the test sets ---------
type SessionResult = {
	user: { id: string } | null;
	session: { activeOrganizationId: string | null } | null;
};
let sessionResult: SessionResult = { user: null, session: null };
const validateRequestHeaders = vi.fn(() => Promise.resolve(sessionResult));

vi.mock("@/server/core/lib/auth", () => ({
	validateRequestHeaders,
}));

// --- permission/access services ----------------------------------------
const checkPermission = vi.fn(() => Promise.resolve());
const assertGitProviderAccess = vi.fn(() => Promise.resolve());

vi.mock("@/server/core/services/permission", () => ({
	checkPermission,
}));

vi.mock("@/server/core/services/git-provider", () => ({
	assertGitProviderAccess,
}));

// --- github service: createGithub / findGithubById ----------------------
const createGithub = vi.fn(() => Promise.resolve({ githubId: "gh_new" }));
// findGithubById resolves to whatever the test stages (or rejects).
type GithubProviderRow = {
	githubAppId: number;
	githubPrivateKey: string;
	gitProviderId: string;
	gitProvider: { organizationId: string };
};
let providerRow: GithubProviderRow | undefined;
const findGithubById = vi.fn(() => {
	if (!providerRow)
		return Promise.reject(new Error("Github Provider not found"));
	return Promise.resolve(providerRow);
});

vi.mock("@/server/core/services/github", () => ({
	createGithub,
	findGithubById,
}));

// --- db: capture the gh_setup update chain ------------------------------
const updateReturning = vi.fn(() => Promise.resolve([{ githubId: "gh_1" }]));
const updateWhere = vi.fn(() => ({ returning: updateReturning }));
const updateSet = vi.fn(() => ({ where: updateWhere }));
const dbUpdate = vi.fn(() => ({ set: updateSet }));

vi.mock("@/server/core/db", () => ({
	db: { update: dbUpdate },
	dbUrl: "postgres://mock:mock@localhost:5432/mock",
}));

// schema import is only used for the eq() column reference; a bare object is fine.
vi.mock("@/server/core/db/schema", () => ({
	github: { githubId: "github.githubId" },
}));

// --- octokit: app-manifest conversion for the gh_init happy path --------
const defaultOctokitRequest = (
	route: string,
	params: Record<string, unknown>,
) => {
	if (route === "POST /app-manifests/{code}/conversions") {
		return Promise.resolve({
			data: {
				name: "my-app",
				html_url: "https://github.com/apps/my-app",
				id: 4242,
				client_id: "Iv1.client",
				client_secret: "secret",
				webhook_secret: "whsec",
				pem: "-----BEGIN PRIVATE KEY-----",
			},
		});
	}
	if (route === "GET /app/installations/{installation_id}") {
		return Promise.resolve({
			data: {
				id: params.installation_id,
				app_id: providerRow?.githubAppId ?? 4242,
			},
		});
	}
	return Promise.reject(new Error(`Unexpected Octokit request: ${route}`));
};
const octokitRequest = vi.fn(defaultOctokitRequest);
vi.mock("octokit", () => ({
	// Must be newable (`new Octokit({})`), so use a real class, not an arrow fn.
	Octokit: class {
		request = octokitRequest;
	},
}));

const { buildGithubSetupState, verifyGithubSetupState } = await import(
	"../../server/web/providers/github-setup-state"
);
const { handleGithubProviderSetupState } = await import(
	"../../server/web/providers/github-setup-init"
);
const { handleGithubProviderSetup } = await import(
	"../../server/web/providers/github-setup"
);

const makeRequest = (params: Record<string, string>, cookie?: string) => {
	const url = new URL("https://docklands.test/api/providers/github/setup");
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return new Request(url, {
		method: "GET",
		headers: cookie ? { cookie } : undefined,
	});
};

const makeSetupStateRequest = (params: Record<string, string>) => {
	const url = new URL(
		"https://docklands.test/api/providers/github/setup-state",
	);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return new Request(url, { method: "GET" });
};

const stateFor = (
	context: Parameters<typeof buildGithubSetupState>[0] = {
		action: "gh_init",
		userId: "u1",
		organizationId: "org-mine",
	},
) => {
	const { state, cookie } = buildGithubSetupState(context);
	return { state, cookie: cookie.split(";")[0] ?? cookie };
};

beforeEach(() => {
	vi.clearAllMocks();
	sessionResult = { user: null, session: null };
	providerRow = undefined;
	checkPermission.mockResolvedValue(undefined);
	assertGitProviderAccess.mockResolvedValue(undefined);
	octokitRequest.mockImplementation(defaultOctokitRequest);
});

describe("handleGithubProviderSetup auth gate", () => {
	it("rejects an unauthenticated gh_init with 401 and creates no provider", async () => {
		sessionResult = { user: null, session: null };
		const { state, cookie } = stateFor();

		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code", state }, cookie),
		);

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({
			error: "Authentication required",
		});
		expect(createGithub).not.toHaveBeenCalled();
		expect(octokitRequest).not.toHaveBeenCalled();
	});

	it("rejects an unauthenticated gh_setup with 401 and performs no db update", async () => {
		sessionResult = { user: null, session: null };
		const { state, cookie } = stateFor({
			action: "gh_setup",
			githubId: "gh_other",
			userId: "u1",
			organizationId: "org-mine",
		});

		const res = await handleGithubProviderSetup(
			makeRequest(
				{
					code: "the-code",
					state,
					installation_id: "999",
				},
				cookie,
			),
		);

		expect(res.status).toBe(401);
		expect(dbUpdate).not.toHaveBeenCalled();
		expect(findGithubById).not.toHaveBeenCalled();
	});

	it("rejects a session without an active organization (401)", async () => {
		// Authenticated user but no active org -> still rejected.
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: null },
		};
		const { state, cookie } = stateFor();

		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code", state }, cookie),
		);

		expect(res.status).toBe(401);
		expect(createGithub).not.toHaveBeenCalled();
	});

	it("rejects a missing code before touching auth (400)", async () => {
		const res = await handleGithubProviderSetup(
			makeRequest({ state: "gh_init" }),
		);
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			error: "Missing code parameter",
		});
		expect(validateRequestHeaders).not.toHaveBeenCalled();
	});

	it("rejects missing setup state before touching auth", async () => {
		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code" }),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			error: "Invalid or expired GitHub setup state",
		});
		expect(validateRequestHeaders).not.toHaveBeenCalled();
		expect(createGithub).not.toHaveBeenCalled();
	});

	it("rejects tampered setup state before touching auth", async () => {
		const { state, cookie } = stateFor();
		const tamperedState = `${state.split(".")[0]}.bad-signature`;

		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code", state: tamperedState }, cookie),
		);

		expect(res.status).toBe(400);
		expect(validateRequestHeaders).not.toHaveBeenCalled();
		expect(createGithub).not.toHaveBeenCalled();
	});

	it("rejects state that does not match the authenticated session", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		const { state, cookie } = stateFor({
			action: "gh_init",
			userId: "u-attacker",
			organizationId: "org-mine",
		});

		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code", state }, cookie),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			error: "Invalid or expired GitHub setup state",
		});
		expect(createGithub).not.toHaveBeenCalled();
	});

	it("rejects callers without git provider create permission", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		checkPermission.mockRejectedValueOnce(
			new TRPCError({ code: "UNAUTHORIZED" }),
		);
		const { state, cookie } = stateFor();

		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code", state }, cookie),
		);

		expect(res.status).toBe(403);
		expect(createGithub).not.toHaveBeenCalled();
	});
});

describe("handleGithubProviderSetup gh_setup org scoping", () => {
	it("returns 403 when binding an installation to a provider in another org", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		// The provider belongs to a DIFFERENT org.
		providerRow = {
			githubAppId: 4242,
			githubPrivateKey: "private-key",
			gitProviderId: "gp_other",
			gitProvider: { organizationId: "org-theirs" },
		};
		const { state, cookie } = stateFor({
			action: "gh_setup",
			githubId: "gh_other",
			userId: "u1",
			organizationId: "org-mine",
		});

		const res = await handleGithubProviderSetup(
			makeRequest(
				{
					code: "the-code",
					state,
					installation_id: "777",
				},
				cookie,
			),
		);

		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
		expect(findGithubById).toHaveBeenCalledWith("gh_other");
		// Cross-org binding must NOT write the installation id.
		expect(dbUpdate).not.toHaveBeenCalled();
	});

	it("rejects gh_setup state that omits the provider id", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		const { state, cookie } = stateFor({
			action: "gh_setup",
			userId: "u1",
			organizationId: "org-mine",
		});

		const res = await handleGithubProviderSetup(
			makeRequest(
				{
					code: "the-code",
					state,
					installation_id: "1",
				},
				cookie,
			),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			error: "Invalid or expired GitHub setup state",
		});
		expect(findGithubById).not.toHaveBeenCalled();
		expect(dbUpdate).not.toHaveBeenCalled();
	});

	it("binds the installation for a provider in the caller's own org", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		providerRow = {
			githubAppId: 4242,
			githubPrivateKey: "private-key",
			gitProviderId: "gp_mine",
			gitProvider: { organizationId: "org-mine" },
		};
		const { state, cookie } = stateFor({
			action: "gh_setup",
			githubId: "gh_mine",
			userId: "u1",
			organizationId: "org-mine",
		});

		const res = await handleGithubProviderSetup(
			makeRequest(
				{
					code: "the-code",
					state,
					installation_id: "555",
				},
				cookie,
			),
		);

		// Redirects back to the git-providers settings page on success.
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain(
			"/dashboard/settings/git-providers",
		);
		expect(findGithubById).toHaveBeenCalledWith("gh_mine");
		expect(assertGitProviderAccess).toHaveBeenCalledWith(
			{ userId: "u1", activeOrganizationId: "org-mine" },
			"gp_mine",
		);
		expect(octokitRequest).toHaveBeenCalledWith(
			"GET /app/installations/{installation_id}",
			{ installation_id: 555 },
		);
		expect(updateSet).toHaveBeenCalledWith({ githubInstallationId: "555" });
		expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
	});

	it("does not bind an installation that GitHub cannot verify", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		providerRow = {
			githubAppId: 4242,
			githubPrivateKey: "private-key",
			gitProviderId: "gp_mine",
			gitProvider: { organizationId: "org-mine" },
		};
		octokitRequest.mockImplementation((route, params) => {
			if (route === "GET /app/installations/{installation_id}") {
				return Promise.resolve({
					data: { id: params.installation_id, app_id: 9999 },
				});
			}
			return defaultOctokitRequest(route, params);
		});
		const { state, cookie } = stateFor({
			action: "gh_setup",
			githubId: "gh_mine",
			userId: "u1",
			organizationId: "org-mine",
		});

		const res = await handleGithubProviderSetup(
			makeRequest(
				{
					code: "the-code",
					state,
					installation_id: "555",
				},
				cookie,
			),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			error: "GitHub installation does not belong to this app.",
		});
		expect(updateSet).not.toHaveBeenCalled();
	});
});

describe("handleGithubProviderSetup gh_init", () => {
	it("creates a provider using session org/user from verified setup state", async () => {
		sessionResult = {
			user: { id: "user-from-session" },
			session: { activeOrganizationId: "org-from-session" },
		};
		const { state, cookie } = stateFor({
			action: "gh_init",
			userId: "user-from-session",
			organizationId: "org-from-session",
		});

		const res = await handleGithubProviderSetup(
			makeRequest(
				{
					code: "the-code",
					state,
				},
				cookie,
			),
		);

		expect(res.status).toBe(307);
		expect(octokitRequest).toHaveBeenCalledWith(
			"POST /app-manifests/{code}/conversions",
			{ code: "the-code" },
		);
		// org/user come from the authenticated session, NOT from state.
		expect(createGithub).toHaveBeenCalledTimes(1);
		expect(createGithub).toHaveBeenCalledWith(
			expect.objectContaining({
				githubAppId: 4242,
				githubClientId: "Iv1.client",
			}),
			"org-from-session",
			"user-from-session",
		);
		expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
	});
});

describe("handleGithubProviderSetupState", () => {
	it("returns a signed gh_init state and httpOnly nonce cookie", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};

		const res = await handleGithubProviderSetupState(
			makeSetupStateRequest({ action: "gh_init" }),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		const cookie = res.headers.get("set-cookie") ?? "";
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		const body = (await res.json()) as { state: string };
		const verified = verifyGithubSetupState(
			new Request("https://docklands.test/callback", {
				headers: { cookie: cookie.split(";")[0] ?? "" },
			}),
			body.state,
		);
		expect(verified).toEqual({
			action: "gh_init",
			userId: "u1",
			organizationId: "org-mine",
		});
	});

	it("rejects setup-state requests from unauthenticated users", async () => {
		sessionResult = { user: null, session: null };

		const res = await handleGithubProviderSetupState(
			makeSetupStateRequest({ action: "gh_init" }),
		);

		expect(res.status).toBe(401);
		expect(checkPermission).not.toHaveBeenCalled();
	});

	it("rejects setup-state requests without git provider create permission", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		checkPermission.mockRejectedValueOnce(
			new TRPCError({ code: "UNAUTHORIZED" }),
		);

		const res = await handleGithubProviderSetupState(
			makeSetupStateRequest({ action: "gh_init" }),
		);

		expect(res.status).toBe(403);
	});

	it("returns a gh_setup state only after provider access is checked", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		providerRow = {
			githubAppId: 4242,
			githubPrivateKey: "private-key",
			gitProviderId: "gp_mine",
			gitProvider: { organizationId: "org-mine" },
		};

		const res = await handleGithubProviderSetupState(
			makeSetupStateRequest({ action: "gh_setup", githubId: "gh_mine" }),
		);

		expect(res.status).toBe(200);
		expect(findGithubById).toHaveBeenCalledWith("gh_mine");
		expect(assertGitProviderAccess).toHaveBeenCalledWith(
			{ userId: "u1", activeOrganizationId: "org-mine" },
			"gp_mine",
		);
		const cookie = res.headers.get("set-cookie") ?? "";
		const body = (await res.json()) as { state: string };
		expect(
			verifyGithubSetupState(
				new Request("https://docklands.test/callback", {
					headers: { cookie: cookie.split(";")[0] ?? "" },
				}),
				body.state,
			),
		).toEqual({
			action: "gh_setup",
			githubId: "gh_mine",
			userId: "u1",
			organizationId: "org-mine",
		});
	});

	it("refuses gh_setup state for a provider in another organization", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		providerRow = {
			githubAppId: 4242,
			githubPrivateKey: "private-key",
			gitProviderId: "gp_other",
			gitProvider: { organizationId: "org-other" },
		};

		const res = await handleGithubProviderSetupState(
			makeSetupStateRequest({ action: "gh_setup", githubId: "gh_other" }),
		);

		expect(res.status).toBe(403);
		expect(assertGitProviderAccess).not.toHaveBeenCalled();
	});
});

describe("GitHub setup UI state initiation", () => {
	it("does not embed raw GitHub setup state strings in browser links/forms", () => {
		const addProvider = readFileSync(
			new URL(
				"../../components/dashboard/settings/git/github/add-github-provider.tsx",
				import.meta.url,
			),
			"utf8",
		);
		const showProviders = readFileSync(
			new URL(
				"../../components/dashboard/settings/git/show-git-providers.tsx",
				import.meta.url,
			),
			"utf8",
		);

		expect(addProvider).toContain("fetchGithubSetupState");
		expect(showProviders).toContain("fetchGithubSetupState");
		expect(addProvider).not.toContain("state=gh_init");
		expect(showProviders).not.toContain("state=gh_setup:");
	});
});
