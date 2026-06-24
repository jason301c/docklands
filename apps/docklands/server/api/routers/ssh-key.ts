import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiCreateSshKey,
	apiFindOneSshKey,
	apiGenerateSSHKey,
	apiRemoveSshKey,
	apiUpdateSshKey,
	sshKeys,
} from "@/server/core/db/schema";
import {
	createSshKey,
	findSSHKeyById,
	removeSSHKeyById,
	updateSSHKeyById,
} from "@/server/core/services/ssh-key";
import { generateSSHKey } from "@/server/core/utils/filesystem/ssh";

export const sshRouter = createTRPCRouter({
	create: withPermission("sshKeys", "create")
		.input(apiCreateSshKey)
		.mutation(async ({ input, ctx }) => {
			try {
				await createSshKey({
					...input,
					organizationId: ctx.session.activeOrganizationId,
				});
				await audit(ctx, {
					action: "create",
					resourceType: "sshKey",
					resourceName: input.name,
				});
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error creating the SSH key",
					cause: error,
				});
			}
		}),
	remove: withPermission("sshKeys", "delete")
		.input(apiRemoveSshKey)
		.mutation(async ({ input, ctx }) => {
			try {
				const sshKey = await findSSHKeyById(input.sshKeyId);
				if (sshKey.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not allowed to delete this SSH key",
					});
				}

				await audit(ctx, {
					action: "delete",
					resourceType: "sshKey",
					resourceId: sshKey.sshKeyId,
					resourceName: sshKey.name,
				});
				return await removeSSHKeyById(input.sshKeyId);
			} catch (error) {
				throw error;
			}
		}),
	one: withPermission("sshKeys", "read")
		.input(apiFindOneSshKey)
		.query(async ({ input, ctx }) => {
			const sshKey = await findSSHKeyById(input.sshKeyId);

			if (sshKey.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not allowed to access this SSH key",
				});
			}
			return sshKey;
		}),
	all: withPermission("sshKeys", "read").query(async ({ ctx }) => {
		// Never ship the (transparently decrypted) private key to the list view —
		// it is write-only material consumed at clone time via the service layer.
		return await db.query.sshKeys.findMany({
			columns: { privateKey: false },
			where: eq(sshKeys.organizationId, ctx.session.activeOrganizationId),
			orderBy: desc(sshKeys.createdAt),
		});
	}),
	allForApps: protectedProcedure.query(async ({ ctx }) => {
		return await db.query.sshKeys.findMany({
			columns: {
				sshKeyId: true,
				name: true,
			},
			where: eq(sshKeys.organizationId, ctx.session.activeOrganizationId),
			orderBy: desc(sshKeys.createdAt),
		});
	}),
	generate: withPermission("sshKeys", "read")
		.input(apiGenerateSSHKey)
		.mutation(async ({ input }) => {
			return await generateSSHKey(input.type);
		}),
	update: withPermission("sshKeys", "create")
		.input(apiUpdateSshKey)
		.mutation(async ({ input, ctx }) => {
			try {
				const sshKey = await findSSHKeyById(input.sshKeyId);
				if (sshKey.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not allowed to update this SSH key",
					});
				}
				const result = await updateSSHKeyById(input);
				await audit(ctx, {
					action: "update",
					resourceType: "sshKey",
					resourceId: sshKey.sshKeyId,
					resourceName: sshKey.name,
				});
				return result;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error updating this SSH key",
					cause: error,
				});
			}
		}),
});
