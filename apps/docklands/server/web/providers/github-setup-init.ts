import { TRPCError } from "@trpc/server";
import { assertGitProviderAccess } from "@/server/core/services/git-provider";
import { findGithubById } from "@/server/core/services/github";
import { checkPermission } from "@/server/core/services/permission";
import { getQueryParam } from "@/server/web/request";
import { buildGithubSetupState } from "./github-setup-state";
import { getProviderOAuthSession } from "./oauth-session";

const jsonWithCookie = (body: unknown, cookie: string, status = 200) => {
	const headers = new Headers({
		"Cache-Control": "no-store",
		"Content-Type": "application/json",
	});
	headers.append("Set-Cookie", cookie);
	return new Response(JSON.stringify(body), { status, headers });
};

const json = (body: unknown, status = 200) =>
	Response.json(body, {
		status,
		headers: { "Cache-Control": "no-store" },
	});

const isUnauthorizedTRPCError = (error: unknown) =>
	error instanceof TRPCError && error.code === "UNAUTHORIZED";

export async function handleGithubProviderSetupState(request: Request) {
	if (request.method !== "GET") {
		return json({ error: "Method not allowed" }, 405);
	}

	const session = await getProviderOAuthSession(request);
	if (!session) {
		return json({ error: "Authentication required" }, 401);
	}

	try {
		await checkPermission(
			{
				user: { id: session.userId },
				session: { activeOrganizationId: session.activeOrganizationId },
			},
			{ gitProviders: ["create"] },
		);
	} catch (error) {
		if (isUnauthorizedTRPCError(error)) {
			return json({ error: "Forbidden" }, 403);
		}
		throw error;
	}

	const url = new URL(request.url);
	const action = getQueryParam(url, "action");
	if (action === "gh_init") {
		const { state, cookie } = buildGithubSetupState({
			action,
			userId: session.userId,
			organizationId: session.activeOrganizationId,
		});
		return jsonWithCookie({ state }, cookie);
	}

	if (action === "gh_setup") {
		const githubId = getQueryParam(url, "githubId");
		if (!githubId) {
			return json({ error: "Missing provider id" }, 400);
		}

		const provider = await findGithubById(githubId).catch(() => null);
		if (!provider) {
			return json({ error: "GitHub provider not found" }, 404);
		}
		if (provider.gitProvider.organizationId !== session.activeOrganizationId) {
			return json({ error: "Forbidden" }, 403);
		}

		try {
			await assertGitProviderAccess(session, provider.gitProviderId);
		} catch (error) {
			if (isUnauthorizedTRPCError(error)) {
				return json({ error: "Forbidden" }, 403);
			}
			throw error;
		}

		const { state, cookie } = buildGithubSetupState({
			action,
			githubId,
			userId: session.userId,
			organizationId: session.activeOrganizationId,
		});
		return jsonWithCookie({ state }, cookie);
	}

	return json({ error: "Invalid GitHub setup action" }, 400);
}
