import { createAppAuth } from "@octokit/auth-app";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { Octokit } from "octokit";
import { db } from "@/server/core/db";
import { github } from "@/server/core/db/schema";
import { assertGitProviderAccess } from "@/server/core/services/git-provider";
import { createGithub, findGithubById } from "@/server/core/services/github";
import { checkPermission } from "@/server/core/services/permission";
import { getQueryParam, jsonResponse } from "@/server/web/request";
import {
	clearGithubSetupStateCookie,
	verifyGithubSetupState,
} from "./github-setup-state";
import { getProviderOAuthSession } from "./oauth-session";
import { redirectWithCookies } from "./oauth-state";

type Query = {
	code: string;
	state: string;
	installation_id: string;
	setup_action: string;
};

const jsonWithClearedState = (body: unknown, status: number) => {
	const headers = new Headers({ "Content-Type": "application/json" });
	headers.append("Set-Cookie", clearGithubSetupStateCookie());
	return new Response(JSON.stringify(body), { status, headers });
};

const isUnauthorizedTRPCError = (error: unknown) =>
	error instanceof TRPCError && error.code === "UNAUTHORIZED";

const assertCanManageGithubSetup = async (session: {
	userId: string;
	activeOrganizationId: string;
}) => {
	await checkPermission(
		{
			user: { id: session.userId },
			session: { activeOrganizationId: session.activeOrganizationId },
		},
		{ gitProviders: ["create"] },
	);
};

const verifyGithubInstallation = async (
	provider: Awaited<ReturnType<typeof findGithubById>>,
	installationId: string,
) => {
	if (!/^\d+$/.test(installationId)) {
		throw new Error("Invalid GitHub installation id.");
	}
	if (!provider.githubAppId || !provider.githubPrivateKey) {
		throw new Error("GitHub provider is missing app credentials.");
	}

	const octokit = new Octokit({
		authStrategy: createAppAuth,
		auth: {
			appId: provider.githubAppId,
			privateKey: provider.githubPrivateKey,
		},
	});
	const { data } = await octokit.request(
		"GET /app/installations/{installation_id}",
		{
			installation_id: Number(installationId),
		},
	);
	const installation = data as { id?: number; app_id?: number };
	if (installation.id !== Number(installationId)) {
		throw new Error("GitHub installation verification failed.");
	}
	if (
		typeof installation.app_id === "number" &&
		installation.app_id !== Number(provider.githubAppId)
	) {
		throw new Error("GitHub installation does not belong to this app.");
	}
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

	const verifiedState = verifyGithubSetupState(request, state);
	if (!verifiedState) {
		return jsonResponse(
			{ error: "Invalid or expired GitHub setup state" },
			400,
		);
	}

	// This callback creates/binds a Git provider (which holds app credentials), so
	// it must be authenticated and scoped to the caller's own org. The state was
	// minted by the same-origin setup-state route and carries a nonce that must
	// match the httpOnly cookie.
	const session = await getProviderOAuthSession(request);
	if (!session) {
		return jsonWithClearedState({ error: "Authentication required" }, 401);
	}
	if (
		verifiedState.userId !== session.userId ||
		verifiedState.organizationId !== session.activeOrganizationId
	) {
		return jsonWithClearedState(
			{ error: "Invalid or expired GitHub setup state" },
			400,
		);
	}

	try {
		await assertCanManageGithubSetup(session);
	} catch (error) {
		if (isUnauthorizedTRPCError(error)) {
			return jsonWithClearedState({ error: "Forbidden" }, 403);
		}
		throw error;
	}

	const action = verifiedState.action;
	// gh_init creates a new provider; gh_setup binds an installation to githubId.

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
			session.userId,
		);
	} else if (action === "gh_setup") {
		const githubId = verifiedState.githubId;
		if (!githubId) {
			return jsonWithClearedState({ error: "Missing provider id" }, 400);
		}
		if (!installation_id) {
			return jsonWithClearedState({ error: "Missing installation id" }, 400);
		}
		// Only let the caller bind an installation to a provider in their own org.
		const provider = await findGithubById(githubId).catch(() => null);
		if (!provider) {
			return jsonWithClearedState({ error: "GitHub provider not found" }, 404);
		}
		if (provider.gitProvider.organizationId !== session.activeOrganizationId) {
			return jsonWithClearedState({ error: "Forbidden" }, 403);
		}
		try {
			await assertGitProviderAccess(session, provider.gitProviderId);
		} catch (error) {
			if (isUnauthorizedTRPCError(error)) {
				return jsonWithClearedState({ error: "Forbidden" }, 403);
			}
			throw error;
		}
		try {
			await verifyGithubInstallation(provider, installation_id);
		} catch (error) {
			return jsonWithClearedState(
				{
					error:
						error instanceof Error
							? error.message
							: "GitHub installation verification failed.",
				},
				400,
			);
		}
		await db
			.update(github)
			.set({
				githubInstallationId: installation_id,
			})
			.where(eq(github.githubId, githubId))
			.returning();
	}

	return redirectWithCookies(request, "/dashboard/settings/git-providers", [
		clearGithubSetupStateCookie(),
	]);
}
