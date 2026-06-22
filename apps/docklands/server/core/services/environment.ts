import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
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
	const environment = await db.query.environments.findFirst({
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
			mariadb: {
				columns: {
					mariadbId: true,
					name: true,
					createdAt: true,
					applicationStatus: true,
					description: true,
					runtimeWorkerId: true,
				},
			},
			mongo: {
				columns: {
					mongoId: true,
					name: true,
					createdAt: true,
					applicationStatus: true,
					description: true,
					runtimeWorkerId: true,
				},
			},
			mysql: {
				columns: {
					mysqlId: true,
					name: true,
					createdAt: true,
					applicationStatus: true,
					description: true,
					runtimeWorkerId: true,
				},
			},
			postgres: {
				columns: {
					postgresId: true,
					name: true,
					description: true,
					createdAt: true,
					applicationStatus: true,
					runtimeWorkerId: true,
				},
			},
			redis: {
				columns: {
					redisId: true,
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
			libsql: {
				columns: {
					libsqlId: true,
					name: true,
					createdAt: true,
					applicationStatus: true,
					description: true,
					runtimeWorkerId: true,
				},
			},
			workspace: true,
		},
	});
	if (!environment) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Environment not found",
		});
	}
	return environment;
};

export const findEnvironmentsByWorkspaceId = async (workspaceId: string) => {
	const workspaceEnvironments = await db.query.environments.findMany({
		where: eq(environments.workspaceId, workspaceId),
		orderBy: asc(environments.createdAt),
		with: {
			applications: true,
			mariadb: true,
			mongo: true,
			mysql: true,
			postgres: true,
			redis: true,
			compose: true,
			libsql: true,
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
		(env.libsql?.length ?? 0) > 0 ||
		(env.mariadb?.length ?? 0) > 0 ||
		(env.mongo?.length ?? 0) > 0 ||
		(env.mysql?.length ?? 0) > 0 ||
		(env.postgres?.length ?? 0) > 0 ||
		(env.redis?.length ?? 0) > 0
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

export const createProductionEnvironment = async (workspaceId: string) => {
	const newEnvironment = await db
		.insert(environments)
		.values({
			name: "production",
			description: "Production environment",
			workspaceId,
			isDefault: true,
		})
		.returning()
		.then((value) => value[0]);

	if (!newEnvironment) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the production environment",
		});
	}

	return newEnvironment;
};
