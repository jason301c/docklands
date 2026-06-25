import { TRPCError } from "@trpc/server";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiBitbucketTestConnection,
	apiCreateBitbucket,
	apiFindBitbucketBranches,
	apiFindOneBitbucket,
	apiUpdateBitbucket,
} from "@/server/core/db/schema";
import {
	createBitbucket,
	findBitbucketById,
	updateBitbucket,
} from "@/server/core/services/bitbucket";
import {
	assertGitProviderAccess,
	getAccessibleGitProviderIds,
} from "@/server/core/services/git-provider";
import {
	getBitbucketBranches,
	getBitbucketRepositories,
	testBitbucketConnection,
} from "@/server/core/utils/providers/bitbucket";

/**
 * Strip the transparently decrypted Bitbucket API token before returning a
 * provider record to the browser. Clone/API flows read it through the service
 * layer, never from tRPC read/update responses.
 */
const sanitizeBitbucket = <T extends { apiToken?: unknown }>(provider: T) => {
	const { apiToken: _apiToken, ...rest } = provider;
	return rest;
};

const assertBitbucketAccess = async (
	ctx: { session: { userId: string; activeOrganizationId?: string | null } },
	bitbucketId: string,
) => {
	const provider = await findBitbucketById(bitbucketId);
	await assertGitProviderAccess(ctx.session, provider.gitProviderId);
	return provider;
};

export const bitbucketRouter = createTRPCRouter({
	create: withPermission("gitProviders", "create")
		.input(apiCreateBitbucket)
		.mutation(async ({ input, ctx }) => {
			try {
				const result = await createBitbucket(
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
					message: "Error creating this Bitbucket provider",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOneBitbucket)
		.query(async ({ input, ctx }) => {
			return sanitizeBitbucket(
				await assertBitbucketAccess(ctx, input.bitbucketId),
			);
		}),
	bitbucketProviders: protectedProcedure.query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleGitProviderIds(ctx.session);

		let result = await db.query.bitbucket.findMany({
			with: {
				gitProvider: true,
			},
			columns: {
				bitbucketId: true,
			},
		});

		result = result.filter((provider) => {
			return (
				provider.gitProvider.organizationId ===
					ctx.session.activeOrganizationId &&
				accessibleIds.has(provider.gitProvider.gitProviderId)
			);
		});
		return result;
	}),

	getBitbucketRepositories: protectedProcedure
		.input(apiFindOneBitbucket)
		.query(async ({ input, ctx }) => {
			await assertBitbucketAccess(ctx, input.bitbucketId);
			return await getBitbucketRepositories(input.bitbucketId);
		}),
	getBitbucketBranches: protectedProcedure
		.input(apiFindBitbucketBranches)
		.query(async ({ input, ctx }) => {
			if (!input.bitbucketId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Bitbucket provider ID is required.",
				});
			}
			await assertBitbucketAccess(ctx, input.bitbucketId);
			return await getBitbucketBranches(input);
		}),
	testConnection: protectedProcedure
		.input(apiBitbucketTestConnection)
		.mutation(async ({ input, ctx }) => {
			await assertBitbucketAccess(ctx, input.bitbucketId);
			try {
				const result = await testBitbucketConnection(input);

				return `Found ${result} repositories`;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error?.message : `Error: ${error}`,
				});
			}
		}),
	update: withPermission("gitProviders", "create")
		.input(apiUpdateBitbucket)
		.mutation(async ({ input, ctx }) => {
			await assertBitbucketAccess(ctx, input.bitbucketId);

			const result = await updateBitbucket(input.bitbucketId, {
				...input,
				organizationId: ctx.session.activeOrganizationId,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "gitProvider",
				resourceId: input.bitbucketId,
				resourceName: input.name,
			});

			return result ? sanitizeBitbucket(result) : result;
		}),
});
