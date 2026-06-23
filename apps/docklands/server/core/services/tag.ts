import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import {
	type apiCreateTag,
	type apiUpdateTag,
	tags,
	workspaces,
	workspaceTags,
} from "@/server/core/db/schema";
import {
	findMemberByUserId,
	isOwnerOrAdmin,
} from "@/server/core/services/permission";

export type Tag = typeof tags.$inferSelect;

export const createTag = async (
	input: z.infer<typeof apiCreateTag>,
	organizationId: string,
) => {
	try {
		const newTag = await db
			.insert(tags)
			.values({
				name: input.name,
				color: input.color,
				organizationId,
			})
			.returning();

		return newTag[0];
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("unique_org_tag_name")
		) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "A tag with this name already exists in your organization",
			});
		}
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error creating tag: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const findTagsByOrganization = async (organizationId: string) => {
	try {
		const organizationTags = await db.query.tags.findMany({
			where: eq(tags.organizationId, organizationId),
			orderBy: (tags, { asc }) => [asc(tags.name)],
		});

		return organizationTags;
	} catch (error) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Error fetching tags: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const findTagById = async (tagId: string, organizationId: string) => {
	try {
		const tag = await db.query.tags.findFirst({
			where: and(
				eq(tags.tagId, tagId),
				eq(tags.organizationId, organizationId),
			),
		});

		if (!tag) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Tag not found",
			});
		}

		return tag;
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Error fetching tag: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const updateTag = async (
	input: z.infer<typeof apiUpdateTag>,
	organizationId: string,
) => {
	try {
		// First verify the tag belongs to the user's organization
		const existingTag = await db.query.tags.findFirst({
			where: and(
				eq(tags.tagId, input.tagId),
				eq(tags.organizationId, organizationId),
			),
		});

		if (!existingTag) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Tag not found or you don't have permission to update it",
			});
		}

		const updatedTag = await db
			.update(tags)
			.set({
				...(input.name !== undefined && { name: input.name }),
				...(input.color !== undefined && { color: input.color }),
			})
			.where(eq(tags.tagId, input.tagId))
			.returning();

		return updatedTag[0];
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		if (
			error instanceof Error &&
			error.message.includes("unique_org_tag_name")
		) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "A tag with this name already exists in your organization",
			});
		}
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error updating tag: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const removeTag = async (tagId: string, organizationId: string) => {
	try {
		// First verify the tag belongs to the user's organization
		const existingTag = await db.query.tags.findFirst({
			where: and(
				eq(tags.tagId, tagId),
				eq(tags.organizationId, organizationId),
			),
		});

		if (!existingTag) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Tag not found or you don't have permission to delete it",
			});
		}

		// Delete the tag - cascade delete will handle workspaceTags associations
		await db.delete(tags).where(eq(tags.tagId, tagId));

		return { success: true };
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error deleting tag: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

/**
 * Shared guard for the workspace-tag mutations (`assignToWorkspace`,
 * `removeFromWorkspace`, `bulkAssign`). It verifies that the caller's member
 * record exists, that the workspace belongs to the org, that the member has
 * access to the workspace, and (for the single-tag flows) that the tag belongs
 * to the org. Preserves the exact checks, error codes, and messages that each
 * mutation used inline before this was hoisted.
 */
export const assertWorkspaceTagAccess = async ({
	userId,
	organizationId,
	workspaceId,
	tagId,
}: {
	userId: string;
	organizationId: string;
	workspaceId: string;
	tagId?: string;
}) => {
	const memberRecord = await findMemberByUserId(userId, organizationId);

	// Verify the workspace belongs to the user's organization
	const workspace = await db.query.workspaces.findFirst({
		where: and(
			eq(workspaces.workspaceId, workspaceId),
			eq(workspaces.organizationId, organizationId),
		),
	});

	if (!workspace) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Workspace not found or you don't have permission to modify it",
		});
	}

	// Verify the member has access to the workspace
	if (
		!isOwnerOrAdmin(memberRecord.role) &&
		!memberRecord.accessedWorkspaces.includes(workspaceId)
	) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You don't have access to this workspace",
		});
	}

	// Verify the tag belongs to the user's organization
	if (tagId !== undefined) {
		const tag = await db.query.tags.findFirst({
			where: and(
				eq(tags.tagId, tagId),
				eq(tags.organizationId, organizationId),
			),
		});

		if (!tag) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Tag not found or you don't have permission to use it",
			});
		}
	}
};

export const assignTagToWorkspace = async ({
	userId,
	organizationId,
	workspaceId,
	tagId,
}: {
	userId: string;
	organizationId: string;
	workspaceId: string;
	tagId: string;
}) => {
	try {
		await assertWorkspaceTagAccess({
			userId,
			organizationId,
			workspaceId,
			tagId,
		});

		// Insert the workspace-tag association
		const newAssociation = await db
			.insert(workspaceTags)
			.values({
				workspaceId,
				tagId,
			})
			.returning();

		return newAssociation[0];
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		if (
			error instanceof Error &&
			error.message.includes("unique_workspace_tag")
		) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "This tag is already assigned to this workspace",
			});
		}
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error assigning tag to workspace: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const removeTagFromWorkspace = async ({
	userId,
	organizationId,
	workspaceId,
	tagId,
}: {
	userId: string;
	organizationId: string;
	workspaceId: string;
	tagId: string;
}) => {
	try {
		await assertWorkspaceTagAccess({
			userId,
			organizationId,
			workspaceId,
			tagId,
		});

		// Delete the workspace-tag association
		await db
			.delete(workspaceTags)
			.where(
				and(
					eq(workspaceTags.workspaceId, workspaceId),
					eq(workspaceTags.tagId, tagId),
				),
			);

		return { success: true };
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error removing tag from workspace: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const bulkAssignTagsToWorkspace = async ({
	userId,
	organizationId,
	workspaceId,
	tagIds,
}: {
	userId: string;
	organizationId: string;
	workspaceId: string;
	tagIds: string[];
}) => {
	try {
		await assertWorkspaceTagAccess({
			userId,
			organizationId,
			workspaceId,
		});

		// Verify all tags belong to the user's organization
		if (tagIds.length > 0) {
			const tagCount = await db.query.tags.findMany({
				where: and(eq(tags.organizationId, organizationId)),
			});

			const validTagIds = tagCount.map((tag) => tag.tagId);
			const invalidTags = tagIds.filter((id) => !validTagIds.includes(id));

			if (invalidTags.length > 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "One or more tags not found in your organization",
				});
			}
		}

		// Delete all existing tag associations for this workspace
		await db
			.delete(workspaceTags)
			.where(eq(workspaceTags.workspaceId, workspaceId));

		// Insert new tag associations
		if (tagIds.length > 0) {
			await db.insert(workspaceTags).values(
				tagIds.map((tagId) => ({
					workspaceId,
					tagId,
				})),
			);
		}

		return { success: true };
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error bulk assigning tags to workspace: ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};
