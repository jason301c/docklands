import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateEnvironment,
	type apiDuplicateEnvironment,
	deployments,
	environments,
} from "@/server/core/db/schema";

export type Environment = typeof environments.$inferSelect;

export const createEnvironment = async (
	input: z.infer<typeof apiCreateEnvironment>,
) => {
	const newEnvironment = await db
		.insert(environments)
		.values({
			...input,
		})
		.returning()
		.then((value) => value[0]);

	if (!newEnvironment) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the environment",
		});
	}

	return newEnvironment;
};

export const findEnvironmentById = async (environmentId: string) => {
	return orThrowNotFound(
		db.query.environments.findFirst({
			where: eq(environments.environmentId, environmentId),
			columns: {
				name: true,
				description: true,
				environmentId: true,
				isDefault: true,
				workspaceId: true,
				env: true,
			},
			with: {
				applications: {
					with: {
						deployments: {
							columns: {
								createdAt: true,
								startedAt: true,
								finishedAt: true,
							},
							orderBy: [desc(deployments.createdAt)],
							limit: 1,
						},
					},
					columns: {
						name: true,
						applicationId: true,
						createdAt: true,
						applicationStatus: true,
						description: true,
						runtimeWorkerId: true,
						icon: true,
					},
				},
				database: {
					columns: {
						databaseId: true,
						engine: true,
						name: true,
						createdAt: true,
						applicationStatus: true,
						description: true,
						runtimeWorkerId: true,
					},
				},
				compose: {
					with: {
						deployments: {
							columns: {
								createdAt: true,
								startedAt: true,
								finishedAt: true,
							},
							orderBy: [desc(deployments.createdAt)],
							limit: 1,
						},
					},
					columns: {
						composeId: true,
						name: true,
						createdAt: true,
						composeStatus: true,
						description: true,
						runtimeWorkerId: true,
					},
				},
				workspace: true,
			},
		}),
		"Environment",
	);
};

export const findEnvironmentsByWorkspaceId = async (workspaceId: string) => {
	const workspaceEnvironments = await db.query.environments.findMany({
		where: eq(environments.workspaceId, workspaceId),
		orderBy: asc(environments.createdAt),
		with: {
			applications: true,
			database: true,
			compose: true,
			workspace: true,
		},
		columns: {
			name: true,
			description: true,
			environmentId: true,
			isDefault: true,
		},
	});
	return workspaceEnvironments;
};

const environmentHasServices = (
	env: Awaited<ReturnType<typeof findEnvironmentById>>,
) => {
	return (
		(env.applications?.length ?? 0) > 0 ||
		(env.compose?.length ?? 0) > 0 ||
		(env.database?.length ?? 0) > 0
	);
};

export const deleteEnvironment = async (environmentId: string) => {
	const currentEnvironment = await findEnvironmentById(environmentId);
	if (currentEnvironment.isDefault) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "You cannot delete the default environment",
		});
	}
	if (environmentHasServices(currentEnvironment)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Cannot delete environment: it has active services. Delete all services first.",
		});
	}
	const deletedEnvironment = await db
		.delete(environments)
		.where(eq(environments.environmentId, environmentId))
		.returning()
		.then((value) => value[0]);

	return deletedEnvironment;
};

export const updateEnvironmentById = async (
	environmentId: string,
	environmentData: Partial<Environment>,
) => {
	const result = await db
		.update(environments)
		.set({
			...environmentData,
		})
		.where(eq(environments.environmentId, environmentId))
		.returning()
		.then((res) => res[0]);

	return result;
};

export const duplicateEnvironment = async (
	input: z.infer<typeof apiDuplicateEnvironment>,
) => {
	// Find the original environment
	const originalEnvironment = await findEnvironmentById(input.environmentId);

	// Create a new environment with the provided name and description
	const newEnvironment = await db
		.insert(environments)
		.values({
			name: input.name,
			description: input.description || originalEnvironment.description,
			workspaceId: originalEnvironment.workspaceId,
			env: originalEnvironment.env,
		})
		.returning()
		.then((value) => value[0]);

	if (!newEnvironment) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error duplicating the environment",
		});
	}

	return newEnvironment;
};
