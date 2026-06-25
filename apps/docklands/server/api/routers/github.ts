import { TRPCError } from "@trpc/server";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiFindGithubBranches,
	apiFindOneGithub,
	apiUpdateGithub,
} from "@/server/core/db/schema";
import {
	assertGitProviderAccess,
	getAccessibleGitProviderIds,
	updateGitProvider,
} from "@/server/core/services/git-provider";
import { findGithubById, updateGithub } from "@/server/core/services/github";
import {
	getGithubBranches,
	getGithubRepositories,
	haveGithubRequirements,
} from "@/server/core/utils/providers/github";

/**
 * Strip the (transparently decrypted) GitHub App secrets before returning to the
 * browser. They are write-only credentials; deploy/clone/webhook flows read them
 * through the service layer (`findGithubById`), never this read procedure.
 */
const sanitizeGithub = <
	T extends {
		githubClientSecret?: unknown;
		githubPrivateKey?: unknown;
		githubWebhookSecret?: unknown;
	},
>(
	provider: T,
) => {
	const {
		githubClientSecret: _githubClientSecret,
		githubPrivateKey: _githubPrivateKey,
		githubWebhookSecret: _githubWebhookSecret,
		...rest
	} = provider;
	return rest;
};

const assertGithubAccess = async (
	ctx: { session: { userId: string; activeOrganizationId?: string | null } },
	githubId: string,
) => {
	const provider = await findGithubById(githubId);
	await assertGitProviderAccess(ctx.session, provider.gitProviderId);
	return provider;
};

export const githubRouter = createTRPCRouter({
	one: protectedProcedure
		.input(apiFindOneGithub)
		.query(async ({ input, ctx }) => {
			return sanitizeGithub(await assertGithubAccess(ctx, input.githubId));
		}),
	getGithubRepositories: protectedProcedure
		.input(apiFindOneGithub)
		.query(async ({ input, ctx }) => {
			await assertGithubAccess(ctx, input.githubId);
			return await getGithubRepositories(input.githubId);
		}),
	getGithubBranches: protectedProcedure
		.input(apiFindGithubBranches)
		.query(async ({ input, ctx }) => {
			if (!input.githubId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "GitHub provider ID is required.",
				});
			}
			await assertGithubAccess(ctx, input.githubId);
			return await getGithubBranches(input);
		}),
	githubProviders: protectedProcedure.query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleGitProviderIds(ctx.session);

		let result = await db.query.github.findMany({
			with: {
				gitProvider: true,
			},
		});

		result = result.filter(
			(provider) =>
				provider.gitProvider.organizationId ===
					ctx.session.activeOrganizationId &&
				accessibleIds.has(provider.gitProvider.gitProviderId),
		);

		const filtered = result
			.filter((provider) => haveGithubRequirements(provider))
			.map((provider) => {
				return {
					githubId: provider.githubId,
					gitProvider: {
						...provider.gitProvider,
					},
				};
			});

		return filtered;
	}),

	testConnection: protectedProcedure
		.input(apiFindOneGithub)
		.mutation(async ({ input, ctx }) => {
			await assertGithubAccess(ctx, input.githubId);
			try {
				const result = await getGithubRepositories(input.githubId);
				return `Found ${result.length} repositories`;
			} catch (err) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: err instanceof Error ? err?.message : `Error: ${err}`,
				});
			}
		}),
	update: withPermission("gitProviders", "create")
		.input(apiUpdateGithub)
		.mutation(async ({ input, ctx }) => {
			const provider = await assertGithubAccess(ctx, input.githubId);
			if (provider.gitProviderId !== input.gitProviderId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "GitHub provider does not match the Git provider.",
				});
			}

			await updateGitProvider(input.gitProviderId, {
				name: input.name,
				organizationId: ctx.session.activeOrganizationId,
			});

			await updateGithub(input.githubId, {
				...input,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "gitProvider",
				resourceId: input.gitProviderId,
				resourceName: input.name,
			});
		}),
});
