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
 *   - gh_setup binding a provider in a different org is rejected (403);
 *   - gh_init derives org/user from the session (not from `state`).
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

// --- github service: createGithub / findGithubById ----------------------
const createGithub = vi.fn(() => Promise.resolve({ githubId: "gh_new" }));
// findGithubById resolves to whatever the test stages (or rejects).
let providerRow: { gitProvider: { organizationId: string } } | undefined;
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
const octokitRequest = vi.fn(() =>
	Promise.resolve({
		data: {
			name: "my-app",
			html_url: "https://github.com/apps/my-app",
			id: 4242,
			client_id: "Iv1.client",
			client_secret: "secret",
			webhook_secret: "whsec",
			pem: "-----BEGIN PRIVATE KEY-----",
		},
	}),
);
vi.mock("octokit", () => ({
	// Must be newable (`new Octokit({})`), so use a real class, not an arrow fn.
	Octokit: class {
		request = octokitRequest;
	},
}));

const { handleGithubProviderSetup } = await import(
	"../../server/web/providers/github-setup"
);

const makeRequest = (params: Record<string, string>) => {
	const url = new URL("https://docklands.test/api/providers/github/setup");
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return new Request(url, { method: "GET" });
};

beforeEach(() => {
	vi.clearAllMocks();
	sessionResult = { user: null, session: null };
	providerRow = undefined;
});

describe("handleGithubProviderSetup auth gate", () => {
	it("rejects an unauthenticated gh_init with 401 and creates no provider", async () => {
		sessionResult = { user: null, session: null };

		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code", state: "gh_init" }),
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

		const res = await handleGithubProviderSetup(
			makeRequest({
				code: "the-code",
				state: "gh_setup:gh_other",
				installation_id: "999",
			}),
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

		const res = await handleGithubProviderSetup(
			makeRequest({ code: "the-code", state: "gh_init" }),
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
});

describe("handleGithubProviderSetup gh_setup org scoping", () => {
	it("returns 403 when binding an installation to a provider in another org", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		// The provider belongs to a DIFFERENT org.
		providerRow = { gitProvider: { organizationId: "org-theirs" } };

		const res = await handleGithubProviderSetup(
			makeRequest({
				code: "the-code",
				state: "gh_setup:gh_other",
				installation_id: "777",
			}),
		);

		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
		expect(findGithubById).toHaveBeenCalledWith("gh_other");
		// Cross-org binding must NOT write the installation id.
		expect(dbUpdate).not.toHaveBeenCalled();
	});

	it("returns 400 when gh_setup omits the provider id", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};

		const res = await handleGithubProviderSetup(
			makeRequest({
				code: "the-code",
				state: "gh_setup:",
				installation_id: "1",
			}),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: "Missing provider id" });
		expect(findGithubById).not.toHaveBeenCalled();
		expect(dbUpdate).not.toHaveBeenCalled();
	});

	it("binds the installation for a provider in the caller's own org", async () => {
		sessionResult = {
			user: { id: "u1" },
			session: { activeOrganizationId: "org-mine" },
		};
		providerRow = { gitProvider: { organizationId: "org-mine" } };

		const res = await handleGithubProviderSetup(
			makeRequest({
				code: "the-code",
				state: "gh_setup:gh_mine",
				installation_id: "555",
			}),
		);

		// Redirects back to the git-providers settings page on success.
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toContain(
			"/dashboard/settings/git-providers",
		);
		expect(findGithubById).toHaveBeenCalledWith("gh_mine");
		expect(updateSet).toHaveBeenCalledWith({ githubInstallationId: "555" });
	});
});

describe("handleGithubProviderSetup gh_init", () => {
	it("creates a provider using session org/user, ignoring any ids in state", async () => {
		sessionResult = {
			user: { id: "user-from-session" },
			session: { activeOrganizationId: "org-from-session" },
		};

		const res = await handleGithubProviderSetup(
			// Extra colon-separated junk in state must be ignored for gh_init.
			makeRequest({
				code: "the-code",
				state: "gh_init:org-attacker:u-attacker",
			}),
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
	});
});
