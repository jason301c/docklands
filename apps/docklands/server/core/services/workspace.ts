import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import {
	type apiCreateWorkspace,
	applications,
	database,
	environments,
	workspaces,
} from "@/server/core/db/schema";

export type Workspace = typeof workspaces.$inferSelect;

export const createWorkspace = async (
	input: z.infer<typeof apiCreateWorkspace>,
	organizationId: string,
) => {
	// Workspace + its production environment are created atomically so a failed
	// environment insert can't leave an orphaned, environment-less workspace.
	return db.transaction(async (tx) => {
		const workspace = await tx
			.insert(workspaces)
			.values({
				...input,
				organizationId: organizationId,
			})
			.returning()
			.then((value) => value[0]);

		if (!workspace) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the workspace",
			});
		}

		// Automatically create a production environment.
		const environment = await tx
			.insert(environments)
			.values({
				name: "production",
				description: "Production environment",
				workspaceId: workspace.workspaceId,
				isDefault: true,
			})
			.returning()
			.then((value) => value[0]);

		if (!environment) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the production environment",
			});
		}

		return { workspace, environment };
	});
};

export const findWorkspaceById = async (workspaceId: string) => {
	const workspace = await db.query.workspaces.findFirst({
		where: eq(workspaces.workspaceId, workspaceId),
		with: {
			environments: {
				with: {
					applications: true,
					compose: true,
					database: true,
				},
			},
			workspaceTags: {
				with: {
					tag: true,
				},
			},
		},
	});
	if (!workspace) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Workspace not found",
		});
	}
	return workspace;
};

export const deleteWorkspace = async (workspaceId: string) => {
	const workspace = await db
		.delete(workspaces)
		.where(eq(workspaces.workspaceId, workspaceId))
		.returning()
		.then((value) => value[0]);

	return workspace;
};

export const updateWorkspaceById = async (
	workspaceId: string,
	workspaceData: Partial<Workspace>,
) => {
	const result = await db
		.update(workspaces)
		.set({
			...workspaceData,
		})
		.where(eq(workspaces.workspaceId, workspaceId))
		.returning()
		.then((res) => res[0]);

	return result;
};

export const validUniqueServerAppName = async (appName: string) => {
	const query = await db.query.environments.findMany({
		with: {
			applications: {
				where: eq(applications.appName, appName),
			},
			database: {
				where: eq(database.appName, appName),
			},
		},
	});

	// Filter out items with non-empty fields
	const nonEmptyProjects = query.filter(
		(workspace) =>
			workspace.applications.length > 0 || workspace.database.length > 0,
	);

	return nonEmptyProjects.length === 0;
};
