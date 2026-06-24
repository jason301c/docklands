import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	workspaceServiceGroups,
	workspaceServiceLayouts,
} from "@/server/core/db/schema";
import type { WorkspaceServiceType } from "@/shared/workspace-graph";
import {
	WORKSPACE_GROUP_DEFAULT_HEIGHT,
	WORKSPACE_GROUP_DEFAULT_WIDTH,
} from "@/shared/workspace-graph";

export type WorkspaceGroupRecord = typeof workspaceServiceGroups.$inferSelect;

export const findWorkspaceGroupById = async (groupId: string) =>
	orThrowNotFound(
		db.query.workspaceServiceGroups.findFirst({
			where: eq(workspaceServiceGroups.groupId, groupId),
		}),
		"Workspace group",
	);

export const listWorkspaceGroupsByEnvironment = async (environmentId: string) =>
	db.query.workspaceServiceGroups.findMany({
		where: eq(workspaceServiceGroups.environmentId, environmentId),
	});

export const createWorkspaceGroup = async (input: {
	environmentId: string;
	name: string;
	color?: string | null;
	x: number;
	y: number;
	width?: number;
	height?: number;
}) => {
	const result = await db
		.insert(workspaceServiceGroups)
		.values({
			environmentId: input.environmentId,
			name: input.name,
			color: input.color ?? null,
			x: input.x,
			y: input.y,
			width: input.width ?? WORKSPACE_GROUP_DEFAULT_WIDTH,
			height: input.height ?? WORKSPACE_GROUP_DEFAULT_HEIGHT,
		})
		.returning()
		.then((rows) => rows[0]);

	if (!result) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Unable to create workspace group",
		});
	}

	return result;
};

export const updateWorkspaceGroup = async (input: {
	groupId: string;
	name?: string;
	color?: string | null;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}) => {
	const { groupId, ...changes } = input;

	// Only persist the fields the caller actually sent; an undefined value must
	// not clobber the stored row (e.g. a drag-stop sends x/y but not name/color).
	const values: Partial<typeof workspaceServiceGroups.$inferInsert> = {
		updatedAt: new Date().toISOString(),
	};
	if (changes.name !== undefined) values.name = changes.name;
	if (changes.color !== undefined) values.color = changes.color;
	if (changes.x !== undefined) values.x = changes.x;
	if (changes.y !== undefined) values.y = changes.y;
	if (changes.width !== undefined) values.width = changes.width;
	if (changes.height !== undefined) values.height = changes.height;

	const result = await db
		.update(workspaceServiceGroups)
		.set(values)
		.where(eq(workspaceServiceGroups.groupId, groupId))
		.returning()
		.then((rows) => rows[0]);

	if (!result) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Workspace group not found",
		});
	}

	return result;
};

export const removeWorkspaceGroup = async (groupId: string) => {
	// The layout FK is `onDelete: set null`, so deleting the group row clears its
	// members' `groupId` automatically — no manual unassign pass is needed.
	const removed = await db
		.delete(workspaceServiceGroups)
		.where(eq(workspaceServiceGroups.groupId, groupId))
		.returning()
		.then((rows) => rows[0]);

	return removed;
};

/**
 * Assign (or clear, when `groupId` is null) a service's group membership.
 * Membership lives on the service's `workspace_service_layout` row, so the layout
 * is upserted: an existing row is patched, otherwise a fresh row is created at a
 * default position the canvas will reconcile against the service's real node.
 */
export const assignWorkspaceServiceGroup = async (input: {
	environmentId: string;
	serviceType: WorkspaceServiceType;
	serviceId: string;
	groupId: string | null;
	x?: number;
	y?: number;
}) => {
	const now = new Date().toISOString();

	const existing = await db.query.workspaceServiceLayouts.findFirst({
		where: and(
			eq(workspaceServiceLayouts.environmentId, input.environmentId),
			eq(workspaceServiceLayouts.serviceType, input.serviceType),
			eq(workspaceServiceLayouts.serviceId, input.serviceId),
		),
	});

	if (existing) {
		const result = await db
			.update(workspaceServiceLayouts)
			.set({ groupId: input.groupId, updatedAt: now })
			.where(eq(workspaceServiceLayouts.layoutId, existing.layoutId))
			.returning()
			.then((rows) => rows[0]);

		if (!result) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Unable to assign workspace group",
			});
		}

		return result;
	}

	const result = await db
		.insert(workspaceServiceLayouts)
		.values({
			environmentId: input.environmentId,
			serviceType: input.serviceType,
			serviceId: input.serviceId,
			groupId: input.groupId,
			x: input.x ?? 0,
			y: input.y ?? 0,
			updatedAt: now,
		})
		.returning()
		.then((rows) => rows[0]);

	if (!result) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Unable to assign workspace group",
		});
	}

	return result;
};
