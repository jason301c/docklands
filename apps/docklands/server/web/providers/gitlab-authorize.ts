import { createLogger } from "@/server/core/lib/logger";
import { findGitlabById } from "@/server/core/services/gitlab";
import { getQueryParam, jsonResponse } from "@/server/web/request";
import { buildOAuthState, redirectWithCookies } from "./oauth-state";

const logger = createLogger("gitlab-authorize");

// Server-side initiation of the GitLab OAuth flow. This exists (rather than the
// browser linking straight to GitLab) so we can attach a CSRF `state` nonce and
// the matching httpOnly cookie that the callback verifies.
export async function handleGitlabAuthorize(request: Request) {
	try {
		if (request.method !== "GET") {
			return jsonResponse({ error: "Method not allowed" }, 405);
		}

		const url = new URL(request.url);
		const gitlabId = getQueryParam(url, "gitlabId");
		if (!gitlabId) {
			return jsonResponse({ error: "Invalid GitLab provider ID" }, 400);
		}

		const gitlab = await findGitlabById(gitlabId);
		if (!gitlab?.applicationId || !gitlab.redirectUri || !gitlab.gitlabUrl) {
			return jsonResponse({ error: "Incomplete OAuth configuration" }, 400);
		}

		const { state, cookie } = buildOAuthState("gitlab", gitlabId);
		// Must match the redirect_uri used in the callback's token exchange.
		const redirectUri = `${gitlab.redirectUri}?gitlabId=${gitlabId}`;

		const authorizationUrl = new URL(`${gitlab.gitlabUrl}/oauth/authorize`);
		authorizationUrl.searchParams.append("client_id", gitlab.applicationId);
		authorizationUrl.searchParams.append("redirect_uri", redirectUri);
		authorizationUrl.searchParams.append("response_type", "code");
		authorizationUrl.searchParams.append(
			"scope",
			"api read_user read_repository",
		);
		authorizationUrl.searchParams.append("state", state);

		return redirectWithCookies(request, authorizationUrl, [cookie]);
	} catch (error) {
		logger.error(
			{ err: error, provider: "gitlab" },
			"Error initiating GitLab OAuth flow",
		);
		return jsonResponse({ error: "Internal server error" }, 500);
	}
}
