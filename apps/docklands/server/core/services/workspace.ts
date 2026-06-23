import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateWorkspace,
	applications,
	compose,
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
	return orThrowNotFound(
		db.query.workspaces.findFirst({
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
		}),
		"Workspace",
	);
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
	// appName feeds the host-wide Docker/Swarm namespace, so it must be unique
	// across applications, databases AND compose services. Three targeted lookups
	// (backed by the appName indexes/unique constraints) instead of loading every
	// environment and its children just to test one name.
	const [app, db_, comp] = await Promise.all([
		db.query.applications.findFirst({
			where: eq(applications.appName, appName),
			columns: { applicationId: true },
		}),
		db.query.database.findFirst({
			where: eq(database.appName, appName),
			columns: { databaseId: true },
		}),
		db.query.compose.findFirst({
			where: eq(compose.appName, appName),
			columns: { composeId: true },
		}),
	]);

	return !app && !db_ && !comp;
};
