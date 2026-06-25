import { TRPCError } from "@trpc/server";
import { createLogger } from "@/server/core/lib/logger";
import { assertGitProviderAccess } from "@/server/core/services/git-provider";
import { updateGitea } from "@/server/core/services/gitea";
import { getQueryParam, redirectResponse } from "@/server/web/request";
import { findGitea, type Gitea, redirectWithError } from "./gitea-helper";
import {
	getProviderOAuthSession,
	oauthStateMatchesSession,
} from "./oauth-session";
import { verifyOAuthState } from "./oauth-state";

const logger = createLogger("gitea-callback");

// Helper to fetch access token from Gitea
const fetchAccessToken = async (gitea: Gitea, code: string) => {
	// Use internal URL for token exchange when Gitea is on same instance as Docklands
	const baseUrl = gitea.giteaInternalUrl || gitea.giteaUrl;
	const response = await fetch(`${baseUrl}/login/oauth/access_token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: new URLSearchParams({
			client_id: gitea.clientId as string,
			client_secret: gitea.clientSecret as string,
			code,
			grant_type: "authorization_code",
			redirect_uri: gitea.redirectUri || "",
		}),
	});

	const responseText = await response.text();
	return response.ok
		? JSON.parse(responseText)
		: { error: "Token exchange failed", responseText };
};

export async function handleGiteaCallback(request: Request) {
	const url = new URL(request.url);
	const code = getQueryParam(url, "code");
	const state = getQueryParam(url, "state");

	if (!code || !state) {
		return redirectWithError(
			request,
			"Invalid authorization code or state parameter",
		);
	}

	// Verify the state context against the cookie set at authorize time; this
	// returns the provider/user/org only for a flow this browser began.
	const verifiedState = verifyOAuthState(request, "gitea", state);
	if (!verifiedState) {
		return redirectWithError(request, "Invalid or expired OAuth state");
	}
	const giteaId = verifiedState.providerId;

	const session = await getProviderOAuthSession(request);
	if (!session) {
		return redirectWithError(request, "Authentication required");
	}

	if (!oauthStateMatchesSession(verifiedState, session)) {
		logger.warn(
			{ provider: "gitea", giteaId },
			"Gitea OAuth callback state did not match authenticated session",
		);
		return redirectWithError(request, "Invalid or expired OAuth state");
	}

	const gitea = await findGitea(giteaId);
	if (!gitea) {
		return redirectWithError(request, "Failed to find Gitea provider");
	}

	try {
		await assertGitProviderAccess(session, gitea.gitProviderId);
	} catch (error) {
		if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
			return redirectWithError(request, "Forbidden");
		}
		throw error;
	}

	// Fetch the access token from Gitea
	const result = await fetchAccessToken(gitea, code);

	if (result.error) {
		// Log only the error fields — never the full result which may echo back client_secret
		logger.warn(
			{
				provider: "gitea",
				giteaId,
				error: result.error,
				error_description: result.error_description,
			},
			"Gitea OAuth token exchange failed",
		);
		return redirectWithError(request, result.error);
	}

	if (!result.access_token) {
		logger.warn(
			{ provider: "gitea", giteaId },
			"Gitea OAuth token exchange returned no access token",
		);
		return redirectWithError(request, "No access token received");
	}

	const expiresAt = result.expires_in
		? Math.floor(Date.now() / 1000) + result.expires_in
		: null;

	try {
		await updateGitea(gitea.giteaId, {
			accessToken: result.access_token,
			refreshToken: result.refresh_token,
			expiresAt,
			...(result.organizationName
				? { organizationName: result.organizationName }
				: {}),
		});

		logger.info(
			{ provider: "gitea", giteaId },
			"Gitea OAuth callback succeeded",
		);
		return redirectResponse(
			request,
			"/dashboard/settings/git-providers?connected=true",
		);
	} catch (updateError) {
		logger.error(
			{ err: updateError, provider: "gitea", giteaId },
			"Failed to persist Gitea access token",
		);
		return redirectWithError(request, "Failed to store access token");
	}
}
