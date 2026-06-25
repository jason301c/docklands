import { TRPCError } from "@trpc/server";
import { createLogger } from "@/server/core/lib/logger";
import { assertGitProviderAccess } from "@/server/core/services/git-provider";
import { findGitlabById, updateGitlab } from "@/server/core/services/gitlab";
import {
	getQueryParam,
	jsonResponse,
	redirectResponse,
} from "@/server/web/request";
import {
	getProviderOAuthSession,
	oauthStateMatchesSession,
} from "./oauth-session";
import { verifyOAuthState } from "./oauth-state";

const logger = createLogger("gitlab-callback");

export async function handleGitlabCallback(request: Request) {
	const urlParams = new URL(request.url);
	const code = getQueryParam(urlParams, "code");
	const gitlabId = getQueryParam(urlParams, "gitlabId");
	const state = getQueryParam(urlParams, "state");

	if (!code || !gitlabId) {
		logger.warn(
			{ provider: "gitlab" },
			"OAuth callback missing code or gitlabId",
		);
		return jsonResponse({ error: "Missing or invalid code" }, 400);
	}

	// CSRF: the `state` nonce must match the cookie set at authorize time and
	// encode this same provider/user/org context. Rejects login-CSRF and
	// account-stitching across users or organizations.
	const verifiedState = verifyOAuthState(request, "gitlab", state);
	if (!verifiedState || verifiedState.providerId !== gitlabId) {
		logger.warn(
			{ provider: "gitlab", gitlabId },
			"GitLab OAuth callback failed state verification",
		);
		return jsonResponse({ error: "Invalid or expired OAuth state" }, 400);
	}

	const session = await getProviderOAuthSession(request);
	if (!session) {
		return jsonResponse({ error: "Authentication required" }, 401);
	}

	if (!oauthStateMatchesSession(verifiedState, session)) {
		logger.warn(
			{ provider: "gitlab", gitlabId },
			"GitLab OAuth callback state did not match authenticated session",
		);
		return jsonResponse({ error: "Invalid or expired OAuth state" }, 400);
	}

	const gitlab = await findGitlabById(gitlabId);
	try {
		await assertGitProviderAccess(session, gitlab.gitProviderId);
	} catch (error) {
		if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
			return jsonResponse({ error: "Forbidden" }, 403);
		}
		throw error;
	}

	// Use internal URL for token exchange when GitLab is on same instance as Docklands
	const baseUrl = gitlab.gitlabInternalUrl || gitlab.gitlabUrl;
	const gitlabUrl = new URL(baseUrl);

	const headers: HeadersInit = {
		"Content-Type": "application/x-www-form-urlencoded",
	};

	// In case of basic auth being present in the URL, we need to remove it from the URL
	// and add it to the Authorization header.
	if (gitlabUrl.username && gitlabUrl.password) {
		headers.Authorization = `Basic ${Buffer.from(`${gitlabUrl.username}:${gitlabUrl.password}`).toString("base64")}`;
	}

	const url =
		gitlabUrl.username && gitlabUrl.password
			? new URL(gitlabUrl, {
					...gitlabUrl,
					username: "",
					password: "",
				}).toString()
			: gitlabUrl.toString();

	const response = await fetch(`${url}/oauth/token`, {
		method: "POST",
		headers,
		body: new URLSearchParams({
			client_id: gitlab.applicationId as string,
			client_secret: gitlab.secret as string,
			code,
			grant_type: "authorization_code",
			redirect_uri: `${gitlab.redirectUri}?gitlabId=${gitlabId}`,
		}),
	});

	const result = await response.json();

	if (!result.access_token || !result.refresh_token) {
		logger.warn(
			{
				provider: "gitlab",
				gitlabId,
				error: result.error,
				error_description: result.error_description,
			},
			"GitLab OAuth token exchange returned no access token",
		);
		return jsonResponse({ error: "Missing or invalid code" }, 400);
	}

	const expiresAt = Math.floor(Date.now() / 1000) + result.expires_in;
	await updateGitlab(gitlab.gitlabId, {
		accessToken: result.access_token,
		refreshToken: result.refresh_token,
		expiresAt,
	});

	logger.info(
		{ provider: "gitlab", gitlabId },
		"GitLab OAuth callback succeeded",
	);
	return redirectResponse(request, "/dashboard/settings/git-providers");
}
