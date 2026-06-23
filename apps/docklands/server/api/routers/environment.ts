import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiCreateEnvironment,
	apiDuplicateEnvironment,
	apiFindOneEnvironment,
	apiRemoveEnvironment,
	apiUpdateEnvironment,
	environments,
	workspaces,
} from "@/server/core/db/schema";
import {
	createEnvironment,
	deleteEnvironment,
	duplicateEnvironment,
	findEnvironmentById,
	findEnvironmentsByWorkspaceId,
	updateEnvironmentById,
} from "@/server/core/services/environment";
import {
	addNewEnvironment,
	checkEnvironmentAccess,
	checkEnvironmentCreationPermission,
	checkEnvironmentDeletionPermission,
	checkPermission,
	findMemberByUserId,
	isOwnerOrAdmin,
} from "@/server/core/services/permission";

// Minimal structural shape the service filter relies on: each environment-with-
// relations object exposes `applications`/`compose`/`database` arrays keyed by
// their respective service id. Both `findEnvironmentById` and
// `findEnvironmentsByWorkspaceId` outputs satisfy this, so the helper stays
// generic over the concrete Drizzle row type and preserves every other field.
type EnvironmentWithServices = {
	applications: { applicationId: string }[];
	compose: { composeId: string }[];
	database: { databaseId: string }[];
};

const filterEnvironmentServices = <E extends EnvironmentWithServices>(
	environment: E,
	accessedServices: string[],
): E => ({
	...environment,
	applications: environment.applications.filter((app) =>
		accessedServices.includes(app.applicationId),
	),
	compose: environment.compose.filter((comp) =>
		accessedServices.includes(comp.composeId),
	),
	// Unified managed-database model: a single engine-discriminated `database`
	// array keyed by `databaseId` (the per-engine arrays were removed).
	database: environment.database.filter((db) =>
		accessedServices.includes(db.databaseId),
	),
});

export const environmentRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateEnvironment)
		.mutation(async ({ input, ctx }) => {
			try {
				await checkEnvironmentCreationPermission(ctx, input.workspaceId);

				if (input.name === "production") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"You cannot create a environment with the name 'production'",
					});
				}

				const environment = await createEnvironment(input);

				await addNewEnvironment(ctx, environment.environmentId);
				await audit(ctx, {
					action: "create",
					resourceType: "environment",
					resourceId: environment.environmentId,
					resourceName: environment.name,
				});
				return environment;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error creating the environment: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),

	one: protectedProcedure
		.input(apiFindOneEnvironment)
		.query(async ({ input, ctx }) => {
			const environment = await findEnvironmentById(input.environmentId);
			if (
				environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You are not allowed to access this environment",
				});
			}

			if (!isOwnerOrAdmin(ctx.user.role)) {
				const { accessedEnvironments, accessedServices } =
					await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);

				if (!accessedEnvironments.includes(environment.environmentId)) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not allowed to access this environment",
					});
				}

				const filteredEnvironment = filterEnvironmentServices(
					environment,
					accessedServices,
				);

				return filteredEnvironment;
			}

			return environment;
		}),

	byWorkspaceId: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ input, ctx }) => {
			try {
				const environments = await findEnvironmentsByWorkspaceId(
					input.workspaceId,
				);

				if (
					environments.some(
						(environment) =>
							environment.workspace.organizationId !==
							ctx.session.activeOrganizationId,
					)
				) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not allowed to access this environment",
					});
				}

				if (!isOwnerOrAdmin(ctx.user.role)) {
					const { accessedEnvironments, accessedServices } =
						await findMemberByUserId(
							ctx.user.id,
							ctx.session.activeOrganizationId,
						);

					const filteredEnvironments = environments
						.filter((environment) =>
							accessedEnvironments.includes(environment.environmentId),
						)
						.map((environment) =>
							filterEnvironmentServices(environment, accessedServices),
						);

					return filteredEnvironments;
				}

				return environments;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error fetching environments: ${error instanceof Error ? error.message : error}`,
				});
			}
		}),

	remove: protectedProcedure
		.input(apiRemoveEnvironment)
		.mutation(async ({ input, ctx }) => {
			try {
				const environment = await findEnvironmentById(input.environmentId);
				if (
					environment.workspace.organizationId !==
					ctx.session.activeOrganizationId
				) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not allowed to access this environment",
					});
				}

				if (environment.isDefault) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "You cannot delete the default environment",
					});
				}

				await checkEnvironmentDeletionPermission(ctx, environment.workspaceId);

				await checkEnvironmentAccess(ctx, input.environmentId, "read");

				const deletedEnvironment = await deleteEnvironment(input.environmentId);
				await audit(ctx, {
					action: "delete",
					resourceType: "environment",
					resourceId: deletedEnvironment?.environmentId,
					resourceName: deletedEnvironment?.name,
				});
				return deletedEnvironment;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error deleting the environment: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),

	update: protectedProcedure
		.input(apiUpdateEnvironment)
		.mutation(async ({ input, ctx }) => {
			try {
				const { environmentId, ...updateData } = input;

				await checkEnvironmentAccess(ctx, environmentId, "read");

				if (updateData.env !== undefined) {
					await checkPermission(ctx, { environmentEnvVars: ["write"] });
				}

				const currentEnvironment = await findEnvironmentById(environmentId);

				if (currentEnvironment.isDefault && updateData.name !== undefined) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "You cannot rename the default environment",
					});
				}
				if (
					currentEnvironment.workspace.organizationId !==
					ctx.session.activeOrganizationId
				) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not allowed to access this environment",
					});
				}

				if (!isOwnerOrAdmin(ctx.user.role)) {
					const { accessedEnvironments } = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);

					if (
						!accessedEnvironments.includes(currentEnvironment.environmentId)
					) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message: "You are not allowed to update this environment",
						});
					}
				}

				const environment = await updateEnvironmentById(
					environmentId,
					updateData,
				);
				if (environment) {
					await audit(ctx, {
						action: "update",
						resourceType: "environment",
						resourceId: environment.environmentId,
						resourceName: environment.name,
					});
				}
				return environment;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error updating the environment: ${error instanceof Error ? error.message : error}`,
				});
			}
		}),

	duplicate: protectedProcedure
		.input(apiDuplicateEnvironment)
		.mutation(async ({ input, ctx }) => {
			try {
				await checkEnvironmentAccess(ctx, input.environmentId, "read");
				const environment = await findEnvironmentById(input.environmentId);
				if (
					environment.workspace.organizationId !==
					ctx.session.activeOrganizationId
				) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not allowed to access this environment",
					});
				}

				if (!isOwnerOrAdmin(ctx.user.role)) {
					const { accessedEnvironments } = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);

					if (!accessedEnvironments.includes(environment.environmentId)) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message: "You are not allowed to duplicate this environment",
						});
					}
				}

				const duplicatedEnvironment = await duplicateEnvironment(input);
				await audit(ctx, {
					action: "create",
					resourceType: "environment",
					resourceId: duplicatedEnvironment.environmentId,
					resourceName: duplicatedEnvironment.name,
					metadata: { duplicatedFrom: input.environmentId },
				});
				return duplicatedEnvironment;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error duplicating the environment: ${error instanceof Error ? error.message : error}`,
				});
			}
		}),

	search: protectedProcedure
		.input(
			z.object({
				q: z.string().optional(),
				name: z.string().optional(),
				description: z.string().optional(),
				workspaceId: z.string().optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const baseConditions = [
				eq(workspaces.organizationId, ctx.session.activeOrganizationId),
			];

			if (input.workspaceId) {
				baseConditions.push(eq(environments.workspaceId, input.workspaceId));
			}

			if (input.q?.trim()) {
				const term = `%${input.q.trim()}%`;
				baseConditions.push(
					or(
						ilike(environments.name, term),
						ilike(environments.description ?? "", term),
					)!,
				);
			}

			if (input.name?.trim()) {
				baseConditions.push(ilike(environments.name, `%${input.name.trim()}%`));
			}
			if (input.description?.trim()) {
				baseConditions.push(
					ilike(
						environments.description ?? "",
						`%${input.description.trim()}%`,
					),
				);
			}

			if (!isOwnerOrAdmin(ctx.user.role)) {
				const { accessedEnvironments } = await findMemberByUserId(
					ctx.user.id,
					ctx.session.activeOrganizationId,
				);
				if (accessedEnvironments.length === 0) return { items: [], total: 0 };
				baseConditions.push(
					sql`${environments.environmentId} IN (${sql.join(
						accessedEnvironments.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				);
			}

			const where = and(...baseConditions);

			const [items, countResult] = await Promise.all([
				db
					.select({
						environmentId: environments.environmentId,
						name: environments.name,
						description: environments.description,
						createdAt: environments.createdAt,
						env: environments.env,
						workspaceId: environments.workspaceId,
						isDefault: environments.isDefault,
					})
					.from(environments)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where)
					.orderBy(desc(environments.createdAt))
					.limit(input.limit)
					.offset(input.offset),
				db
					.select({ count: sql<number>`count(*)::int` })
					.from(environments)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where),
			]);

			return {
				items,
				total: countResult[0]?.count ?? 0,
			};
		}),
});
