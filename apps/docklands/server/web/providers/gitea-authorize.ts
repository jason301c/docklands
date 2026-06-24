import { createLogger } from "@/server/core/lib/logger";
import { getQueryParam, jsonResponse } from "@/server/web/request";
import { findGitea, redirectWithError } from "./gitea-helper";
import { buildOAuthState, redirectWithCookies } from "./oauth-state";

const logger = createLogger("gitea-authorize");

export async function handleGiteaAuthorize(request: Request) {
	try {
		if (request.method !== "GET") {
			return jsonResponse({ error: "Method not allowed" }, 405);
		}

		const url = new URL(request.url);
		const giteaId = getQueryParam(url, "giteaId");

		if (!giteaId) {
			return jsonResponse({ error: "Invalid Gitea provider ID" }, 400);
		}

		const gitea = await findGitea(giteaId);
		if (!gitea?.clientId || !gitea.redirectUri) {
			return redirectWithError(request, "Incomplete OAuth configuration");
		}

		// CSRF: bind this flow to the browser via a nonce in `state` + cookie.
		const { state, cookie } = buildOAuthState("gitea", giteaId);

		// Generate the Gitea authorization URL
		const authorizationUrl = new URL(`${gitea.giteaUrl}/login/oauth/authorize`);
		authorizationUrl.searchParams.append("client_id", gitea.clientId);
		authorizationUrl.searchParams.append("response_type", "code");
		authorizationUrl.searchParams.append("redirect_uri", gitea.redirectUri);
		authorizationUrl.searchParams.append("scope", "read:user repo");
		authorizationUrl.searchParams.append("state", state);

		// Redirect user to Gitea authorization URL, storing the nonce cookie.
		return redirectWithCookies(request, authorizationUrl, [cookie]);
	} catch (error) {
		logger.error(
			{ err: error, provider: "gitea" },
			"Error initiating Gitea OAuth flow",
		);
		return jsonResponse({ error: "Internal runtimeWorker error" }, 500);
	}
}
