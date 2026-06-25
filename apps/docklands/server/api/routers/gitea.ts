import { TRPCError } from "@trpc/server";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiCreateGitea,
	apiFindGiteaBranches,
	apiFindOneGitea,
	apiGiteaTestConnection,
	apiUpdateGitea,
} from "@/server/core/db/schema";
import {
	assertGitProviderAccess,
	getAccessibleGitProviderIds,
	updateGitProvider,
} from "@/server/core/services/git-provider";
import {
	createGitea,
	findGiteaById,
	updateGitea,
} from "@/server/core/services/gitea";
import {
	getGiteaBranches,
	getGiteaRepositories,
	haveGiteaRequirements,
	testGiteaConnection,
} from "@/server/core/utils/providers/gitea";

/**
 * Strip the transparently decrypted Gitea OAuth secret + tokens before
 * returning to the browser. Clone/OAuth flows read them through the service
 * layer, never this read procedure.
 */
const sanitizeGitea = <
	T extends {
		clientSecret?: unknown;
		accessToken?: unknown;
		refreshToken?: unknown;
	},
>(
	provider: T,
) => {
	const {
		clientSecret: _clientSecret,
		accessToken: _accessToken,
		refreshToken: _refreshToken,
		...rest
	} = provider;
	return rest;
};

const assertGiteaAccess = async (
	ctx: { session: { userId: string; activeOrganizationId?: string | null } },
	giteaId: string,
) => {
	const provider = await findGiteaById(giteaId);
	await assertGitProviderAccess(ctx.session, provider.gitProviderId);
	return provider;
};

export const giteaRouter = createTRPCRouter({
	create: withPermission("gitProviders", "create")
		.input(apiCreateGitea)
		.mutation(async ({ input, ctx }) => {
			try {
				const result = await createGitea(
					input,
					ctx.session.activeOrganizationId,
					ctx.session.userId,
				);

				await audit(ctx, {
					action: "create",
					resourceType: "gitProvider",
					resourceId: result.giteaId,
					resourceName: input.name,
				});

				return result;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error creating this Gitea provider",
					cause: error,
				});
			}
		}),

	one: protectedProcedure
		.input(apiFindOneGitea)
		.query(async ({ input, ctx }) => {
			return sanitizeGitea(await assertGiteaAccess(ctx, input.giteaId));
		}),

	giteaProviders: protectedProcedure.query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleGitProviderIds(ctx.session);

		let result = await db.query.gitea.findMany({
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
			.filter((provider) => haveGiteaRequirements(provider))
			.map((provider) => {
				return {
					giteaId: provider.giteaId,
					gitProvider: {
						...provider.gitProvider,
					},
				};
			});

		return filtered;
	}),

	getGiteaRepositories: protectedProcedure
		.input(apiFindOneGitea)
		.query(async ({ input, ctx }) => {
			const { giteaId } = input;

			if (!giteaId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Gitea provider ID is required.",
				});
			}

			await assertGiteaAccess(ctx, giteaId);
			try {
				const repositories = await getGiteaRepositories(giteaId);
				return repositories;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				});
			}
		}),

	getGiteaBranches: protectedProcedure
		.input(apiFindGiteaBranches)
		.query(async ({ input, ctx }) => {
			const { giteaId, owner, repositoryName } = input;

			if (!giteaId || !owner || !repositoryName) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Gitea provider ID, owner, and repository name are required.",
				});
			}

			await assertGiteaAccess(ctx, giteaId);
			try {
				return await getGiteaBranches({
					giteaId,
					owner,
					repo: repositoryName,
				});
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				});
			}
		}),

	testConnection: protectedProcedure
		.input(apiGiteaTestConnection)
		.mutation(async ({ input, ctx }) => {
			const giteaId = input.giteaId ?? "";

			await assertGiteaAccess(ctx, giteaId);
			try {
				const result = await testGiteaConnection({
					giteaId,
				});

				return `Found ${result} repositories`;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				});
			}
		}),

	update: withPermission("gitProviders", "create")
		.input(apiUpdateGitea)
		.mutation(async ({ input, ctx }) => {
			const provider = await assertGiteaAccess(ctx, input.giteaId);
			if (provider.gitProviderId !== input.gitProviderId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Gitea provider does not match the Git provider.",
				});
			}

			const updateInput = { ...input };
			if (!updateInput.clientSecret) {
				delete updateInput.clientSecret;
			}

			if (input.name) {
				await updateGitProvider(input.gitProviderId, {
					name: input.name,
					organizationId: ctx.session.activeOrganizationId,
				});

				await updateGitea(input.giteaId, updateInput);
			} else {
				await updateGitea(input.giteaId, updateInput);
			}

			await audit(ctx, {
				action: "update",
				resourceType: "gitProvider",
				resourceId: input.giteaId,
				resourceName: input.name,
			});

			return { success: true };
		}),

	getGiteaUrl: protectedProcedure
		.input(apiFindOneGitea)
		.query(async ({ input, ctx }) => {
			const { giteaId } = input;

			if (!giteaId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Gitea provider ID is required.",
				});
			}

			const giteaProvider = await assertGiteaAccess(ctx, giteaId);

			// Return the base URL of the Gitea instance
			return giteaProvider.giteaUrl;
		}),
});
