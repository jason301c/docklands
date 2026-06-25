import { TRPCError } from "@trpc/server";
import { createLogger } from "@/server/core/lib/logger";
import { assertGitProviderAccess } from "@/server/core/services/git-provider";
import { getQueryParam, jsonResponse } from "@/server/web/request";
import { findGitea, redirectWithError } from "./gitea-helper";
import { getProviderOAuthSession } from "./oauth-session";
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

		const session = await getProviderOAuthSession(request);
		if (!session) {
			return jsonResponse({ error: "Authentication required" }, 401);
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

		if (!gitea?.clientId || !gitea.redirectUri) {
			return redirectWithError(request, "Incomplete OAuth configuration");
		}

		// Bind this flow to both the browser and the authenticated Docklands user.
		const { state, cookie } = buildOAuthState("gitea", {
			providerId: giteaId,
			userId: session.userId,
			organizationId: session.activeOrganizationId,
		});

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
