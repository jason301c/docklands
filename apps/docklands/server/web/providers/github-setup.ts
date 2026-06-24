import { eq } from "drizzle-orm";
import { Octokit } from "octokit";
import { db } from "@/server/core/db";
import { github } from "@/server/core/db/schema";
import { validateRequestHeaders } from "@/server/core/lib/auth";
import { createGithub, findGithubById } from "@/server/core/services/github";
import {
	getQueryParam,
	jsonResponse,
	redirectResponse,
} from "@/server/web/request";

type Query = {
	code: string;
	state: string;
	installation_id: string;
	setup_action: string;
};

export async function handleGithubProviderSetup(request: Request) {
	const url = new URL(request.url);
	const query: Query = {
		code: getQueryParam(url, "code") ?? "",
		state: getQueryParam(url, "state") ?? "",
		installation_id: getQueryParam(url, "installation_id") ?? "",
		setup_action: getQueryParam(url, "setup_action") ?? "",
	};
	const { code, state, installation_id } = query;

	if (!code) {
		return jsonResponse({ error: "Missing code parameter" }, 400);
	}

	// This callback creates/binds a Git provider (which holds app credentials), so
	// it must be authenticated and scoped to the caller's own org — never trust the
	// organization/user ids carried in `state`. GitHub redirects the user's browser
	// here, so the session cookie is present.
	const { user, session } = await validateRequestHeaders(request.headers);
	if (!user || !session?.activeOrganizationId) {
		return jsonResponse({ error: "Authentication required" }, 401);
	}

	const [action, ...rest] = state?.split(":");
	// gh_init creates a new provider; gh_setup binds an installation to rest[0].

	if (action === "gh_init") {
		const octokit = new Octokit({});
		const { data } = await octokit.request(
			"POST /app-manifests/{code}/conversions",
			{
				code: code as string,
			},
		);

		await createGithub(
			{
				name: data.name,
				githubAppName: data.html_url,
				githubAppId: data.id,
				githubClientId: data.client_id,
				githubClientSecret: data.client_secret,
				githubWebhookSecret: data.webhook_secret,
				githubPrivateKey: data.pem,
			},
			// Derived from the authenticated session, not from `state`.
			session.activeOrganizationId,
			user.id,
		);
	} else if (action === "gh_setup") {
		const githubId = rest[0];
		if (!githubId) {
			return jsonResponse({ error: "Missing provider id" }, 400);
		}
		// Only let the caller bind an installation to a provider in their own org.
		const provider = await findGithubById(githubId);
		if (provider.gitProvider.organizationId !== session.activeOrganizationId) {
			return jsonResponse({ error: "Forbidden" }, 403);
		}
		await db
			.update(github)
			.set({
				githubInstallationId: installation_id,
			})
			.where(eq(github.githubId, githubId))
			.returning();
	}

	return redirectResponse(request, "/dashboard/settings/git-providers");
}
