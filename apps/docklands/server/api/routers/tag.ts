import { z } from "zod";
import {
	apiCreateTag,
	apiFindOneTag,
	apiRemoveTag,
	apiUpdateTag,
} from "@/server/core/db/schema";
import {
	assignTagToWorkspace,
	bulkAssignTagsToWorkspace,
	createTag,
	findTagById,
	findTagsByOrganization,
	removeTag,
	removeTagFromWorkspace,
	updateTag,
} from "@/server/core/services/tag";
import { createTRPCRouter, protectedProcedure, withPermission } from "../trpc";

export const tagRouter = createTRPCRouter({
	create: withPermission("tag", "create")
		.input(apiCreateTag)
		.mutation(async ({ input, ctx }) => {
			return createTag(input, ctx.session.activeOrganizationId);
		}),

	all: protectedProcedure.query(async ({ ctx }) => {
		return findTagsByOrganization(ctx.session.activeOrganizationId);
	}),

	one: protectedProcedure.input(apiFindOneTag).query(async ({ input, ctx }) => {
		return findTagById(input.tagId, ctx.session.activeOrganizationId);
	}),

	update: withPermission("tag", "update")
		.input(apiUpdateTag)
		.mutation(async ({ input, ctx }) => {
			return updateTag(input, ctx.session.activeOrganizationId);
		}),

	remove: withPermission("tag", "delete")
		.input(apiRemoveTag)
		.mutation(async ({ input, ctx }) => {
			return removeTag(input.tagId, ctx.session.activeOrganizationId);
		}),

	assignToWorkspace: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string().min(1),
				tagId: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return assignTagToWorkspace({
				userId: ctx.user.id,
				organizationId: ctx.session.activeOrganizationId,
				workspaceId: input.workspaceId,
				tagId: input.tagId,
			});
		}),

	removeFromWorkspace: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string().min(1),
				tagId: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return removeTagFromWorkspace({
				userId: ctx.user.id,
				organizationId: ctx.session.activeOrganizationId,
				workspaceId: input.workspaceId,
				tagId: input.tagId,
			});
		}),

	bulkAssign: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string().min(1),
				tagIds: z.array(z.string().min(1)),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return bulkAssignTagsToWorkspace({
				userId: ctx.user.id,
				organizationId: ctx.session.activeOrganizationId,
				workspaceId: input.workspaceId,
				tagIds: input.tagIds,
			});
		}),
});
