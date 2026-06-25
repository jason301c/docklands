import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { betterAuthSecret } from "@/server/core/lib/auth-secret";

const COOKIE_NAME = "docklands_github_setup_state";
const MAX_AGE_SECONDS = 600;

type GithubSetupAction = "gh_init" | "gh_setup";

export type GithubSetupStateContext = {
	action: GithubSetupAction;
	githubId?: string;
	userId: string;
	organizationId: string;
};

type GithubSetupStatePayload = GithubSetupStateContext & {
	nonce: string;
	expiresAt: number;
};

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

const isSetupAction = (value: unknown): value is GithubSetupAction =>
	value === "gh_init" || value === "gh_setup";

const encodePayload = (payload: GithubSetupStatePayload) =>
	Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const signPayload = (encodedPayload: string) =>
	createHmac("sha256", betterAuthSecret)
		.update(encodedPayload)
		.digest("base64url");

const safeEqual = (a: string, b: string): boolean => {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
};

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

const decodePayload = (
	encodedPayload: string,
): GithubSetupStatePayload | null => {
	try {
		const payload = JSON.parse(
			Buffer.from(encodedPayload, "base64url").toString("utf8"),
		) as Partial<GithubSetupStatePayload>;
		if (
			!isSetupAction(payload.action) ||
			!isNonEmptyString(payload.userId) ||
			!isNonEmptyString(payload.organizationId) ||
			!isNonEmptyString(payload.nonce) ||
			typeof payload.expiresAt !== "number"
		) {
			return null;
		}
		if (payload.action === "gh_setup" && !isNonEmptyString(payload.githubId)) {
			return null;
		}
		return {
			action: payload.action,
			githubId: payload.githubId,
			userId: payload.userId,
			organizationId: payload.organizationId,
			nonce: payload.nonce,
			expiresAt: payload.expiresAt,
		};
	} catch {
		return null;
	}
};

export const buildGithubSetupState = (context: GithubSetupStateContext) => {
	const nonce = randomBytes(16).toString("hex");
	const payload = encodePayload({
		...context,
		nonce,
		expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
	});
	const signature = signPayload(payload);
	const state = `${payload}.${signature}`;
	const cookie = `${COOKIE_NAME}=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
	return { state, cookie };
};

export const clearGithubSetupStateCookie = () =>
	`${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export const verifyGithubSetupState = (
	request: Request,
	state: string | undefined,
): GithubSetupStateContext | null => {
	if (!state) return null;
	const [payload, signature] = state.split(".");
	if (!payload || !signature) return null;
	if (!safeEqual(signature, signPayload(payload))) return null;
	const decoded = decodePayload(payload);
	if (!decoded || decoded.expiresAt < Date.now()) return null;
	const cookieNonce = readCookie(request.headers.get("cookie"), COOKIE_NAME);
	if (!cookieNonce || !safeEqual(cookieNonce, decoded.nonce)) return null;
	return {
		action: decoded.action,
		githubId: decoded.githubId,
		userId: decoded.userId,
		organizationId: decoded.organizationId,
	};
};
