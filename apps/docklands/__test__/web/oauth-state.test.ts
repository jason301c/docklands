import { describe, expect, it } from "vitest";
import {
	buildOAuthState,
	clearOAuthStateCookie,
	verifyOAuthState,
} from "../../server/web/providers/oauth-state";

/**
 * CSRF protection for the provider OAuth handshakes. `buildOAuthState` mints a
 * nonce, embeds it in the OAuth `state` (`<providerId>.<nonce>`), and stores it
 * in an httpOnly cookie. `verifyOAuthState` only returns the providerId when the
 * state's nonce matches the nonce in the request's cookie for the same `kind` —
 * proving the same browser that started the flow is finishing it.
 */

const COOKIE_NAME = (kind: string) => `docklands_oauth_state_${kind}`;

const requestWithCookie = (cookie?: string) =>
	new Request("https://x/cb", {
		headers: cookie ? { cookie } : {},
	});

describe("buildOAuthState", () => {
	it("encodes the providerId and a hex nonce into state and sets a matching httpOnly cookie", () => {
		const { state, cookie } = buildOAuthState("gitlab", "provider-123");

		// state shape: "<providerId>.<nonce>"
		const idx = state.lastIndexOf(".");
		expect(idx).toBeGreaterThan(0);
		const providerId = state.slice(0, idx);
		const nonce = state.slice(idx + 1);
		expect(providerId).toBe("provider-123");
		// 16 random bytes -> 32 hex chars
		expect(nonce).toMatch(/^[0-9a-f]{32}$/);

		// cookie carries the same nonce under the kind-scoped name, and is httpOnly
		expect(cookie.startsWith(`${COOKIE_NAME("gitlab")}=${nonce};`)).toBe(true);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=600");
	});

	it("mints a fresh nonce on each call", () => {
		const a = buildOAuthState("gitea", "p");
		const b = buildOAuthState("gitea", "p");
		expect(a.state).not.toBe(b.state);
		expect(a.cookie).not.toBe(b.cookie);
	});

	it("keeps providerIds containing dots intact (verify uses lastIndexOf)", () => {
		const { state, cookie } = buildOAuthState("gitlab", "prov.with.dots");
		const nonce = cookie.split("=")[1]?.split(";")[0] ?? "";
		const req = requestWithCookie(`${COOKIE_NAME("gitlab")}=${nonce}`);
		expect(verifyOAuthState(req, "gitlab", state)).toBe("prov.with.dots");
	});
});

describe("verifyOAuthState", () => {
	it("returns the providerId when the cookie nonce matches the state nonce", () => {
		const { state, cookie } = buildOAuthState("gitlab", "provider-123");
		// The browser sends back the nonce cookie (just the name=value pair).
		const cookiePair = cookie.split(";")[0];
		const req = requestWithCookie(cookiePair);

		expect(verifyOAuthState(req, "gitlab", state)).toBe("provider-123");
	});

	it("tolerates other cookies alongside the state cookie", () => {
		const { state, cookie } = buildOAuthState("gitlab", "provider-123");
		const cookiePair = cookie.split(";")[0];
		const req = requestWithCookie(`session=abc; ${cookiePair}; theme=dark`);

		expect(verifyOAuthState(req, "gitlab", state)).toBe("provider-123");
	});

	it("returns null when no cookie is present", () => {
		const { state } = buildOAuthState("gitlab", "provider-123");
		const req = requestWithCookie();
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});

	it("returns null when the cookie nonce does not match the state nonce", () => {
		const { state } = buildOAuthState("gitlab", "provider-123");
		const req = requestWithCookie(
			`${COOKIE_NAME("gitlab")}=0000000000000000000000000000ffff`,
		);
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});

	it("returns null when the cookie is for a different kind", () => {
		const { state, cookie } = buildOAuthState("gitlab", "provider-123");
		const nonce = cookie.split("=")[1]?.split(";")[0] ?? "";
		// Same nonce value, but stored under the gitea cookie name; verifying as
		// gitlab must not find it.
		const req = requestWithCookie(`${COOKIE_NAME("gitea")}=${nonce}`);
		expect(verifyOAuthState(req, "gitlab", state)).toBeNull();
	});

	it("returns null for malformed state: empty", () => {
		const { cookie } = buildOAuthState("gitlab", "provider-123");
		const req = requestWithCookie(cookie.split(";")[0]);
		expect(verifyOAuthState(req, "gitlab", "")).toBeNull();
	});

	it("returns null for malformed state: undefined", () => {
		const { cookie } = buildOAuthState("gitlab", "provider-123");
		const req = requestWithCookie(cookie.split(";")[0]);
		expect(verifyOAuthState(req, "gitlab", undefined)).toBeNull();
	});

	it("returns null for malformed state: no dot separator", () => {
		const { cookie } = buildOAuthState("gitlab", "provider-123");
		const nonce = cookie.split("=")[1]?.split(";")[0] ?? "";
		const req = requestWithCookie(`${COOKIE_NAME("gitlab")}=${nonce}`);
		// No "." -> lastIndexOf returns -1 -> rejected.
		expect(verifyOAuthState(req, "gitlab", `provider123${nonce}`)).toBeNull();
	});

	it("returns null for malformed state: leading dot (empty providerId)", () => {
		const { cookie } = buildOAuthState("gitlab", "provider-123");
		const nonce = cookie.split("=")[1]?.split(";")[0] ?? "";
		const req = requestWithCookie(`${COOKIE_NAME("gitlab")}=${nonce}`);
		// idx === 0 -> rejected (idx <= 0).
		expect(verifyOAuthState(req, "gitlab", `.${nonce}`)).toBeNull();
	});

	it("returns null for malformed state: trailing dot (empty nonce)", () => {
		const req = requestWithCookie(`${COOKIE_NAME("gitlab")}=somecookienonce`);
		// nonce slice is empty -> rejected.
		expect(verifyOAuthState(req, "gitlab", "provider-123.")).toBeNull();
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
