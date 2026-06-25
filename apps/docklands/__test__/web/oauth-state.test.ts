import { describe, expect, it } from "vitest";
import {
	buildOAuthState,
	clearOAuthStateCookie,
	verifyOAuthState,
} from "../../server/web/providers/oauth-state";

/**
 * CSRF protection for the provider OAuth handshakes. `buildOAuthState` mints a
 * nonce, embeds the provider/user/org context in the OAuth `state`, and stores
 * the nonce in an httpOnly cookie. `verifyOAuthState` only returns the context
 * when the state's nonce matches the request cookie for the same `kind`, proving
 * the same authenticated browser that started the flow is finishing it.
 */

const COOKIE_NAME = (kind: string) => `docklands_oauth_state_${kind}`;
const STATE_CONTEXT = {
	providerId: "provider-123",
	userId: "user-456",
	organizationId: "org-789",
};

const requestWithCookie = (cookie?: string) =>
	new Request("https://x/cb", {
		headers: cookie ? { cookie } : {},
	});

const decodeState = (state: string) =>
	JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as Record<
		string,
		string
	>;

describe("buildOAuthState", () => {
	it("encodes provider, user, org, kind, and a hex nonce into state with a matching httpOnly cookie", () => {
		const { state, cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		const payload = decodeState(state);

		expect(payload).toMatchObject({
			kind: "gitlab",
			providerId: "provider-123",
			userId: "user-456",
			organizationId: "org-789",
		});
		// 16 random bytes -> 32 hex chars
		expect(payload.nonce).toMatch(/^[0-9a-f]{32}$/);

		// cookie carries the same nonce under the kind-scoped name, and is httpOnly
		expect(
			cookie.startsWith(`${COOKIE_NAME("gitlab")}=${payload.nonce};`),
		).toBe(true);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=600");
	});

	it("mints a fresh nonce on each call", () => {
		const a = buildOAuthState("gitea", STATE_CONTEXT);
		const b = buildOAuthState("gitea", STATE_CONTEXT);
		expect(a.state).not.toBe(b.state);
		expect(a.cookie).not.toBe(b.cookie);
	});

	it("keeps ids containing dots intact", () => {
		const context = {
			providerId: "prov.with.dots",
			userId: "user.with.dots",
			organizationId: "org.with.dots",
		};
		const { state, cookie } = buildOAuthState("gitlab", context);
		const nonce = cookie.split("=")[1]?.split(";")[0] ?? "";
		const req = requestWithCookie(`${COOKIE_NAME("gitlab")}=${nonce}`);
		expect(verifyOAuthState(req, "gitlab", state)).toEqual(context);
	});
});

describe("verifyOAuthState", () => {
	it("returns the provider/user/org context when the cookie nonce matches the state nonce", () => {
		const { state, cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		// The browser sends back the nonce cookie (just the name=value pair).
		const cookiePair = cookie.split(";")[0];
		const req = requestWithCookie(cookiePair);

		expect(verifyOAuthState(req, "gitlab", state)).toEqual(STATE_CONTEXT);
	});

	it("tolerates other cookies alongside the state cookie", () => {
		const { state, cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		const cookiePair = cookie.split(";")[0];
		const req = requestWithCookie(`session=abc; ${cookiePair}; theme=dark`);

		expect(verifyOAuthState(req, "gitlab", state)).toEqual(STATE_CONTEXT);
	});

	it("returns null when no cookie is present", () => {
		const { state } = buildOAuthState("gitlab", STATE_CONTEXT);
		const req = requestWithCookie();
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});

	it("returns null when the cookie nonce does not match the state nonce", () => {
		const { state } = buildOAuthState("gitlab", STATE_CONTEXT);
		const req = requestWithCookie(
			`${COOKIE_NAME("gitlab")}=0000000000000000000000000000ffff`,
		);
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});

	it("returns null when the cookie is for a different kind", () => {
		const { state, cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		const nonce = cookie.split("=")[1]?.split(";")[0] ?? "";
		// Same nonce value, but stored under the gitea cookie name; verifying as
		// gitlab must not find it.
		const req = requestWithCookie(`${COOKIE_NAME("gitea")}=${nonce}`);
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});

	it("returns null when the encoded kind does not match", () => {
		const { state, cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		const req = requestWithCookie(cookie.split(";")[0]);
		expect(verifyOAuthState(req, "gitea", state)).toBeNull();
	});

	it("returns null for malformed state: empty", () => {
		const { cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		const req = requestWithCookie(cookie.split(";")[0]);
		expect(verifyOAuthState(req, "gitlab", "")).toBeNull();
	});

	it("returns null for malformed state: undefined", () => {
		const { cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		const req = requestWithCookie(cookie.split(";")[0]);
		expect(verifyOAuthState(req, "gitlab", undefined)).toBeNull();
	});

	it("returns null for malformed state: not JSON", () => {
		const { cookie } = buildOAuthState("gitlab", STATE_CONTEXT);
		const req = requestWithCookie(cookie.split(";")[0]);
		expect(verifyOAuthState(req, "gitlab", "not-a-state-payload")).toBeNull();
	});

	it("returns null for malformed state: missing providerId", () => {
		const { state: originalState, cookie } = buildOAuthState(
			"gitlab",
			STATE_CONTEXT,
		);
		const payload = decodeState(originalState);
		delete payload.providerId;
		const state = Buffer.from(JSON.stringify(payload), "utf8").toString(
			"base64url",
		);
		const req = requestWithCookie(cookie.split(";")[0]);
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});

	it("returns null for malformed state: empty nonce", () => {
		const payload = {
			kind: "gitlab",
			...STATE_CONTEXT,
			nonce: "",
		};
		const state = Buffer.from(JSON.stringify(payload), "utf8").toString(
			"base64url",
		);
		const req = requestWithCookie(`${COOKIE_NAME("gitlab")}=somecookienonce`);
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});
});

describe("clearOAuthStateCookie", () => {
	it("expires the kind-scoped cookie", () => {
		const cleared = clearOAuthStateCookie("gitlab");
		expect(cleared.startsWith(`${COOKIE_NAME("gitlab")}=;`)).toBe(true);
		expect(cleared).toContain("Max-Age=0");
		expect(cleared).toContain("HttpOnly");
	});
});
