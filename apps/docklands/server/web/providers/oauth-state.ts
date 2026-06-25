import { randomBytes, timingSafeEqual } from "node:crypto";

// Per-flow CSRF protection for the provider OAuth handshakes (gitlab/gitea).
// At authorize time we mint a random nonce, embed the expected provider/user/org
// context in the OAuth `state`, and store the nonce in an httpOnly cookie. The
// callback only proceeds if the state nonce matches the cookie and the encoded
// user/org match the authenticated session finishing the flow.

const COOKIE_PREFIX = "docklands_oauth_state_";
const MAX_AGE_SECONDS = 600;

const cookieName = (kind: string) => `${COOKIE_PREFIX}${kind}`;

export type OAuthStateContext = {
	providerId: string;
	userId: string;
	organizationId: string;
};

type OAuthStatePayload = OAuthStateContext & {
	kind: string;
	nonce: string;
};

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

const encodeStatePayload = (payload: OAuthStatePayload) =>
	Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const decodeStatePayload = (state: string): OAuthStatePayload | null => {
	try {
		const payload = JSON.parse(
			Buffer.from(state, "base64url").toString("utf8"),
		) as Partial<OAuthStatePayload>;
		if (
			!isNonEmptyString(payload.kind) ||
			!isNonEmptyString(payload.providerId) ||
			!isNonEmptyString(payload.userId) ||
			!isNonEmptyString(payload.organizationId) ||
			!isNonEmptyString(payload.nonce)
		) {
			return null;
		}
		return {
			kind: payload.kind,
			providerId: payload.providerId,
			userId: payload.userId,
			organizationId: payload.organizationId,
			nonce: payload.nonce,
		};
	} catch {
		return null;
	}
};

export const buildOAuthState = (kind: string, context: OAuthStateContext) => {
	const nonce = randomBytes(16).toString("hex");
	const state = encodeStatePayload({ ...context, kind, nonce });
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
 * Verify the OAuth `state` against the nonce cookie. Returns the provider/user
 * context encoded in the state on success, or null if the state is malformed or
 * the nonce does not match the cookie.
 */
export const verifyOAuthState = (
	request: Request,
	kind: string,
	state: string | undefined,
): OAuthStateContext | null => {
	if (!state) return null;
	const payload = decodeStatePayload(state);
	if (!payload || payload.kind !== kind) return null;
	const cookieNonce = readCookie(
		request.headers.get("cookie"),
		cookieName(kind),
	);
	if (!cookieNonce || !safeEqual(cookieNonce, payload.nonce)) return null;
	return {
		providerId: payload.providerId,
		userId: payload.userId,
		organizationId: payload.organizationId,
	};
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
