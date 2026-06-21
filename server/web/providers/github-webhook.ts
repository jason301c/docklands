import { redirectResponse } from "@/server/web/request";

export async function handleGithubProviderWebhook(request: Request) {
	if (request.method === "POST") {
		const xGitHubEvent = request.headers.get("x-github-event");

		if (xGitHubEvent === "ping") {
			return redirectResponse(request, "/dashboard/settings/git-providers");
		}

		return redirectResponse(request, "/dashboard/settings/git-providers");
	}

	return new Response(`Method ${request.method} not allowed`, {
		status: 405,
		headers: {
			Allow: "POST",
		},
	});
}
