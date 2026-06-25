import { TRPCError } from "@trpc/server";
import { createLogger } from "@/server/core/lib/logger";
import { assertGitProviderAccess } from "@/server/core/services/git-provider";
import { findGitlabById } from "@/server/core/services/gitlab";
import { getQueryParam, jsonResponse } from "@/server/web/request";
import { getProviderOAuthSession } from "./oauth-session";
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

		const session = await getProviderOAuthSession(request);
		if (!session) {
			return jsonResponse({ error: "Authentication required" }, 401);
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

		if (!gitlab?.applicationId || !gitlab.redirectUri || !gitlab.gitlabUrl) {
			return jsonResponse({ error: "Incomplete OAuth configuration" }, 400);
		}

		const { state, cookie } = buildOAuthState("gitlab", {
			providerId: gitlabId,
			userId: session.userId,
			organizationId: session.activeOrganizationId,
		});
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
