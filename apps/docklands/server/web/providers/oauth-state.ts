import { randomBytes, timingSafeEqual } from "node:crypto";

// Per-flow CSRF protection for the provider OAuth handshakes (gitlab/gitea).
// At authorize time we mint a random nonce, embed it in the OAuth `state`, and
// store it in an httpOnly cookie. The callback only proceeds if the `state`
// nonce matches the cookie — proving the same browser that started the flow is
// completing it, which defeats login-CSRF / account-stitching attacks.

const COOKIE_PREFIX = "docklands_oauth_state_";
const MAX_AGE_SECONDS = 600;

const cookieName = (kind: string) => `${COOKIE_PREFIX}${kind}`;

export const buildOAuthState = (kind: string, providerId: string) => {
	const nonce = randomBytes(16).toString("hex");
	const state = `${providerId}.${nonce}`;
	const cookie = `${cookieName(kind)}=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
	return { state, cookie };
};

export const clearOAuthStateCookie = (kind: string) =>
	`${cookieName(kind)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

const readCookie = (header: string | null, name: string): string | null => {
	if (!header) return null;
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
	}
	return null;
};

const safeEqual = (a: string, b: string): boolean => {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
};

/**
 * Verify the OAuth `state` against the nonce cookie. Returns the providerId
 * encoded in the state on success, or null if the state is malformed or the
 * nonce does not match the cookie.
 */
export const verifyOAuthState = (
	request: Request,
	kind: string,
	state: string | undefined,
): string | null => {
	if (!state) return null;
	const idx = state.lastIndexOf(".");
	if (idx <= 0) return null;
	const providerId = state.slice(0, idx);
	const nonce = state.slice(idx + 1);
	if (!providerId || !nonce) return null;
	const cookieNonce = readCookie(
		request.headers.get("cookie"),
		cookieName(kind),
	);
	if (!cookieNonce || !safeEqual(cookieNonce, nonce)) return null;
	return providerId;
};

/**
 * A redirect Response that also sets cookies. `Response.redirect()` returns an
 * immutable Response, so build it by hand to attach Set-Cookie headers.
 */
export const redirectWithCookies = (
	request: Request,
	location: string | URL,
	cookies: string[],
	status = 307,
) => {
	const headers = new Headers({
		Location: new URL(location.toString(), request.url).toString(),
	});
	for (const cookie of cookies) headers.append("Set-Cookie", cookie);
	return new Response(null, { status, headers });
};
