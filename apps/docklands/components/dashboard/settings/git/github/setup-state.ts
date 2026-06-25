type GithubSetupStateResponse = {
	state?: string;
	error?: string;
};

export const fetchGithubSetupState = async (
	params: URLSearchParams,
): Promise<string> => {
	const response = await fetch(`/api/providers/github/setup-state?${params}`, {
		credentials: "same-origin",
	});
	const body = (await response
		.json()
		.catch(() => ({}))) as GithubSetupStateResponse;
	if (!response.ok || !body.state) {
		throw new Error(body.error || "Could not prepare GitHub setup.");
	}
	return body.state;
};
