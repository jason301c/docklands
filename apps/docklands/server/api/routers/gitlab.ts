import { TRPCError } from "@trpc/server";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiCreateGitlab,
	apiFindGitlabBranches,
	apiFindOneGitlab,
	apiGitlabTestConnection,
	apiUpdateGitlab,
} from "@/server/core/db/schema";
import {
	assertGitProviderAccess,
	getAccessibleGitProviderIds,
	updateGitProvider,
} from "@/server/core/services/git-provider";
import {
	createGitlab,
	findGitlabById,
	updateGitlab,
} from "@/server/core/services/gitlab";
import {
	getGitlabBranches,
	getGitlabRepositories,
	haveGitlabRequirements,
	testGitlabConnection,
} from "@/server/core/utils/providers/gitlab";

/**
 * Strip the (transparently decrypted) GitLab OAuth secret + tokens before
 * returning to the browser. They are write-only credentials; clone/OAuth flows
 * read them through the service layer (`findGitlabById`), never this read.
 */
const sanitizeGitlab = <
	T extends { secret?: unknown; accessToken?: unknown; refreshToken?: unknown },
>(
	provider: T,
) => {
	const {
		secret: _secret,
		accessToken: _accessToken,
		refreshToken: _refreshToken,
		...rest
	} = provider;
	return rest;
};

const assertGitlabAccess = async (
	ctx: { session: { userId: string; activeOrganizationId?: string | null } },
	gitlabId: string,
) => {
	const provider = await findGitlabById(gitlabId);
	await assertGitProviderAccess(ctx.session, provider.gitProviderId);
	return provider;
};

export const gitlabRouter = createTRPCRouter({
	create: withPermission("gitProviders", "create")
		.input(apiCreateGitlab)
		.mutation(async ({ input, ctx }) => {
			try {
				const result = await createGitlab(
					input,
					ctx.session.activeOrganizationId,
					ctx.session.userId,
				);

				await audit(ctx, {
					action: "create",
					resourceType: "gitProvider",
					resourceName: input.name,
				});

				return result;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error creating this Gitlab provider",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOneGitlab)
		.query(async ({ input, ctx }) => {
			return sanitizeGitlab(await assertGitlabAccess(ctx, input.gitlabId));
		}),
	gitlabProviders: protectedProcedure.query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleGitProviderIds(ctx.session);

		let result = await db.query.gitlab.findMany({
			with: {
				gitProvider: true,
			},
		});

		result = result.filter((provider) => {
			return (
				provider.gitProvider.organizationId ===
					ctx.session.activeOrganizationId &&
				accessibleIds.has(provider.gitProvider.gitProviderId)
			);
		});
		const filtered = result
			.filter((provider) => haveGitlabRequirements(provider))
			.map((provider) => {
				return {
					gitlabId: provider.gitlabId,
					gitProvider: {
						...provider.gitProvider,
					},
					gitlabUrl: provider.gitlabUrl,
				};
			});

		return filtered;
	}),
	getGitlabRepositories: protectedProcedure
		.input(apiFindOneGitlab)
		.query(async ({ input, ctx }) => {
			await assertGitlabAccess(ctx, input.gitlabId);
			return await getGitlabRepositories(input.gitlabId);
		}),

	getGitlabBranches: protectedProcedure
		.input(apiFindGitlabBranches)
		.query(async ({ input, ctx }) => {
			if (!input.gitlabId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "GitLab provider ID is required.",
				});
			}
			await assertGitlabAccess(ctx, input.gitlabId);
			return await getGitlabBranches(input);
		}),
	testConnection: protectedProcedure
		.input(apiGitlabTestConnection)
		.mutation(async ({ input, ctx }) => {
			await assertGitlabAccess(ctx, input.gitlabId);
			try {
				const result = await testGitlabConnection(input);

				return `Found ${result} repositories`;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error?.message : `Error: ${error}`,
				});
			}
		}),
	update: withPermission("gitProviders", "create")
		.input(apiUpdateGitlab)
		.mutation(async ({ input, ctx }) => {
			const provider = await assertGitlabAccess(ctx, input.gitlabId);
			if (provider.gitProviderId !== input.gitProviderId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "GitLab provider does not match the Git provider.",
				});
			}

			if (input.name) {
				await updateGitProvider(input.gitProviderId, {
					name: input.name,
					organizationId: ctx.session.activeOrganizationId,
				});

				await updateGitlab(input.gitlabId, {
					...input,
				});
			} else {
				await updateGitlab(input.gitlabId, {
					...input,
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "gitProvider",
				resourceId: input.gitProviderId,
				resourceName: input.name,
			});
		}),
});
