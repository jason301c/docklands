import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateBitbucket,
	type apiUpdateBitbucket,
	bitbucket,
	gitProvider,
} from "@/server/core/db/schema";

export type Bitbucket = typeof bitbucket.$inferSelect;

export const createBitbucket = async (
	input: z.infer<typeof apiCreateBitbucket>,
	organizationId: string,
	userId: string,
) => {
	return await db.transaction(async (tx) => {
		const newGitProvider = await tx
			.insert(gitProvider)
			.values({
				providerType: "bitbucket",
				organizationId: organizationId,
				name: input.name,
				userId: userId,
			})
			.returning()
			.then((response) => response[0]);

		if (!newGitProvider) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the Bitbucket provider",
			});
		}

		await tx
			.insert(bitbucket)
			.values({
				...input,
				gitProviderId: newGitProvider?.gitProviderId,
			})
			.returning()
			.then((response) => response[0]);
	});
};

export const findBitbucketById = async (bitbucketId: string) => {
	return orThrowNotFound(
		db.query.bitbucket.findFirst({
			where: eq(bitbucket.bitbucketId, bitbucketId),
			with: {
				gitProvider: true,
			},
		}),
		"Bitbucket Provider",
	);
};

export const updateBitbucket = async (
	bitbucketId: string,
	input: z.infer<typeof apiUpdateBitbucket>,
) => {
	return await db.transaction(async (tx) => {
		// First get the current bitbucket provider to get gitProviderId
		const currentProvider = await tx.query.bitbucket.findFirst({
			where: eq(bitbucket.bitbucketId, bitbucketId),
		});

		if (!currentProvider) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Bitbucket provider not found",
			});
		}

		const updatePayload: Partial<typeof bitbucket.$inferInsert> = {
			bitbucketUsername: input.bitbucketUsername,
			bitbucketEmail: input.bitbucketEmail,
			bitbucketWorkspaceName: input.bitbucketWorkspaceName,
		};

		if (input.apiToken) {
			updatePayload.apiToken = input.apiToken;
		}

		const result = await tx
			.update(bitbucket)
			.set(updatePayload)
			.where(eq(bitbucket.bitbucketId, bitbucketId))
			.returning();

		if (input.name || input.organizationId) {
			await tx
				.update(gitProvider)
				.set({
					name: input.name,
					organizationId: input.organizationId,
				})
				.where(eq(gitProvider.gitProviderId, currentProvider.gitProviderId))
				.returning();
		}

		return result[0];
	});
};
