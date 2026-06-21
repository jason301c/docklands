import { eq } from "drizzle-orm";
import { Octokit } from "octokit";
import { db } from "@/server/core/db";
import { github } from "@/server/core/db/schema";
import { createGithub } from "@/server/core/services/github";
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
	const [action, ...rest] = state?.split(":");
	// For gh_init: rest[0] = organizationId, rest[1] = userId
	// For gh_setup: rest[0] = githubProviderId

	if (action === "gh_init") {
		const organizationId = rest[0];
		const userId = rest[1] || getQueryParam(url, "userId");

		if (!userId) {
			return jsonResponse({ error: "Missing userId parameter" }, 400);
		}

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
			organizationId as string,
			userId,
		);
	} else if (action === "gh_setup") {
		await db
			.update(github)
			.set({
				githubInstallationId: installation_id,
			})
			.where(eq(github.githubId, rest[0] as string))
			.returning();
	}

	return redirectResponse(request, "/dashboard/settings/git-providers");
}
