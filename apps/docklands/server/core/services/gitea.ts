import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateGitea,
	gitea,
	gitProvider,
} from "@/server/core/db/schema";

export type Gitea = typeof gitea.$inferSelect;

export const createGitea = async (
	input: z.infer<typeof apiCreateGitea>,
	organizationId: string,
	userId: string,
) => {
	return await db.transaction(async (tx) => {
		const newGitProvider = await tx
			.insert(gitProvider)
			.values({
				providerType: "gitea",
				organizationId: organizationId,
				name: input.name,
				userId: userId,
			})
			.returning()
			.then((response) => response[0]);

		if (!newGitProvider) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the Git provider",
			});
		}

		const giteaProvider = await tx
			.insert(gitea)
			.values({
				...input,
				gitProviderId: newGitProvider?.gitProviderId,
			})
			.returning()
			.then((response: (typeof gitea.$inferSelect)[]) => response[0]);

		if (!giteaProvider) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the Gitea provider",
			});
		}

		return {
			giteaId: giteaProvider.giteaId,
			clientId: giteaProvider.clientId,
			giteaUrl: giteaProvider.giteaUrl,
		};
	});
};

export const findGiteaById = async (giteaId: string) => {
	return orThrowNotFound(
		db.query.gitea.findFirst({
			where: eq(gitea.giteaId, giteaId),
			with: {
				gitProvider: true,
			},
		}),
		"Gitea Provider",
	);
};

export const updateGitea = async (giteaId: string, input: Partial<Gitea>) => {
	try {
		const updateResult = await db
			.update(gitea)
			.set(input)
			.where(eq(gitea.giteaId, giteaId))
			.returning();

		const result = updateResult[0] as Gitea | undefined;

		if (!result) {
			throw new Error(`Failed to update Gitea provider with ID ${giteaId}`);
		}

		return result;
	} catch (error) {
		throw error;
	}
};
