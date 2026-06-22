import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { IS_CLOUD } from "@/server/core/constants/env";
import { db } from "@/server/core/db";
import {
	apiChangeMongoStatus,
	apiCreateMongo,
	apiDeployMongo,
	apiFindOneMongo,
	apiRebuildMongo,
	apiResetMongo,
	apiSaveEnvironmentVariablesMongo,
	apiSaveExternalPortMongo,
	apiUpdateMongo,
	DATABASE_PASSWORD_MESSAGE,
	DATABASE_PASSWORD_REGEX,
	environments,
	mongo as mongoTable,
	workspaces,
} from "@/server/core/db/schema";
import { cancelJobs } from "@/server/core/runtime/backup";
import { findBackupsByDbId } from "@/server/core/services/backup";
import { getContainerLogs } from "@/server/core/services/docker";
import { findEnvironmentById } from "@/server/core/services/environment";
import {
	createMongo,
	deployMongo,
	findMongoById,
	removeMongoById,
	updateMongoById,
} from "@/server/core/services/mongo";
import { createMount } from "@/server/core/services/mount";
import {
	addNewService,
	checkServiceAccess,
	checkServicePermissionAndAccess,
	findMemberByUserId,
} from "@/server/core/services/permission";
import { getAccessibleRuntimeWorkerIds } from "@/server/core/services/runtime-worker";
import { checkPortInUse } from "@/server/core/services/settings";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { findWorkspaceById } from "@/server/core/services/workspace";
import { getServiceContainerCommand } from "@/server/core/utils/backups/utils";
import { rebuildDatabase } from "@/server/core/utils/databases/rebuild";
import {
	removeService,
	startService,
	startServiceRemote,
	stopService,
	stopServiceRemote,
} from "@/server/core/utils/docker/utils";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";

export const mongoRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateMongo)
		.mutation(async ({ input, ctx }) => {
			try {
				const environment = await findEnvironmentById(input.environmentId);
				const workspace = await findWorkspaceById(environment.workspaceId);

				await checkServiceAccess(ctx, workspace.workspaceId, "create");

				const webServerSettings = await getWebServerSettings();
				if (
					(IS_CLOUD || webServerSettings?.remoteServersOnly) &&
					!input.runtimeWorkerId
				) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You need to select a runtime worker to create a mongo",
					});
				}

				if (workspace.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this workspace",
					});
				}

				if (input.runtimeWorkerId) {
					const accessibleIds = await getAccessibleRuntimeWorkerIds(
						ctx.session,
					);
					if (!accessibleIds.has(input.runtimeWorkerId)) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You are not authorized to access this runtime worker",
						});
					}
				}

				const newMongo = await createMongo({
					...input,
				});
				await addNewService(ctx, newMongo.mongoId);

				await createMount({
					serviceId: newMongo.mongoId,
					serviceType: "mongo",
					volumeName: `${newMongo.appName}-data`,
					mountPath: "/data/db",
					type: "volume",
				});

				await audit(ctx, {
					action: "create",
					resourceType: "service",
					resourceId: newMongo.mongoId,
					resourceName: newMongo.appName,
				});
				return newMongo;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error input: Inserting mongo database",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOneMongo)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.mongoId, "read");

			const mongo = await findMongoById(input.mongoId);
			if (
				mongo.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this mongo",
				});
			}
			return mongo;
		}),

	start: protectedProcedure
		.input(apiFindOneMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				deployment: ["create"],
			});
			const service = await findMongoById(input.mongoId);

			if (service.runtimeWorkerId) {
				await startServiceRemote(service.runtimeWorkerId, service.appName);
			} else {
				await startService(service.appName);
			}
			await updateMongoById(input.mongoId, {
				applicationStatus: "done",
			});

			await audit(ctx, {
				action: "start",
				resourceType: "service",
				resourceId: service.mongoId,
				resourceName: service.appName,
			});
			return service;
		}),
	stop: protectedProcedure
		.input(apiFindOneMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				deployment: ["create"],
			});
			const mongo = await findMongoById(input.mongoId);

			if (mongo.runtimeWorkerId) {
				await stopServiceRemote(mongo.runtimeWorkerId, mongo.appName);
			} else {
				await stopService(mongo.appName);
			}
			await updateMongoById(input.mongoId, {
				applicationStatus: "idle",
			});

			await audit(ctx, {
				action: "stop",
				resourceType: "service",
				resourceId: mongo.mongoId,
				resourceName: mongo.appName,
			});
			return mongo;
		}),
	saveExternalPort: protectedProcedure
		.input(apiSaveExternalPortMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				service: ["create"],
			});
			const mongo = await findMongoById(input.mongoId);

			if (input.externalPort) {
				const portCheck = await checkPortInUse(
					input.externalPort,
					mongo.runtimeWorkerId || undefined,
				);
				if (portCheck.isInUse) {
					throw new TRPCError({
						code: "CONFLICT",
						message: `Port ${input.externalPort} is already in use by ${portCheck.conflictingContainer}`,
					});
				}
			}

			await updateMongoById(input.mongoId, {
				externalPort: input.externalPort,
			});
			await deployMongo(input.mongoId);
			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: mongo.mongoId,
				resourceName: mongo.appName,
			});
			return mongo;
		}),
	deploy: protectedProcedure
		.input(apiDeployMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				deployment: ["create"],
			});
			const mongo = await findMongoById(input.mongoId);
			await audit(ctx, {
				action: "deploy",
				resourceType: "service",
				resourceId: mongo.mongoId,
				resourceName: mongo.appName,
			});
			return deployMongo(input.mongoId);
		}),
	deployWithLogs: protectedProcedure
		.meta({
			openapi: {
				path: "/deploy/mongo-with-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiDeployMongo)
		.subscription(async function* ({ input, ctx, signal }) {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				deployment: ["create"],
			});
			const queue: string[] = [];
			let done = false;

			deployMongo(input.mongoId, (log) => {
				queue.push(log);
			})
				.catch(() => {})
				.finally(() => {
					done = true;
				});

			while (!done || queue.length > 0) {
				if (queue.length > 0) {
					yield queue.shift()!;
				} else {
					await new Promise((r) => setTimeout(r, 50));
				}

				if (signal?.aborted) {
					return;
				}
			}
		}),

	changeStatus: protectedProcedure
		.input(apiChangeMongoStatus)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				deployment: ["create"],
			});
			const mongo = await findMongoById(input.mongoId);
			await updateMongoById(input.mongoId, {
				applicationStatus: input.applicationStatus,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: mongo.mongoId,
				resourceName: mongo.appName,
			});
			return mongo;
		}),
	reload: protectedProcedure
		.input(apiResetMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				deployment: ["create"],
			});
			const mongo = await findMongoById(input.mongoId);
			if (mongo.runtimeWorkerId) {
				await stopServiceRemote(mongo.runtimeWorkerId, mongo.appName);
			} else {
				await stopService(mongo.appName);
			}
			await updateMongoById(input.mongoId, {
				applicationStatus: "idle",
			});

			if (mongo.runtimeWorkerId) {
				await startServiceRemote(mongo.runtimeWorkerId, mongo.appName);
			} else {
				await startService(mongo.appName);
			}
			await updateMongoById(input.mongoId, {
				applicationStatus: "done",
			});
			await audit(ctx, {
				action: "reload",
				resourceType: "service",
				resourceId: mongo.mongoId,
				resourceName: mongo.appName,
			});
			return true;
		}),
	remove: protectedProcedure
		.input(apiFindOneMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.mongoId, "delete");

			const mongo = await findMongoById(input.mongoId);

			if (
				mongo.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to delete this mongo",
				});
			}
			await audit(ctx, {
				action: "delete",
				resourceType: "service",
				resourceId: mongo.mongoId,
				resourceName: mongo.appName,
			});
			const backups = await findBackupsByDbId(input.mongoId, "mongo");

			const cleanupOperations = [
				async () => await removeService(mongo?.appName, mongo.runtimeWorkerId),
				async () => await cancelJobs(backups),
				async () => await removeMongoById(input.mongoId),
			];

			for (const operation of cleanupOperations) {
				try {
					await operation();
				} catch (_) {}
			}

			return mongo;
		}),
	saveEnvironment: protectedProcedure
		.input(apiSaveEnvironmentVariablesMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				envVars: ["write"],
			});
			const service = await updateMongoById(input.mongoId, {
				env: input.env,
			});

			if (!service) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error adding environment variables",
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: input.mongoId,
			});
			return true;
		}),
	update: protectedProcedure
		.input(apiUpdateMongo)
		.mutation(async ({ input, ctx }) => {
			const { mongoId, ...rest } = input;
			await checkServicePermissionAndAccess(ctx, mongoId, {
				service: ["create"],
			});
			const service = await updateMongoById(mongoId, {
				...rest,
			});

			if (!service) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Update: Error updating Mongo",
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: mongoId,
				resourceName: service.appName,
			});
			return true;
		}),
	changePassword: protectedProcedure
		.input(
			z.object({
				mongoId: z.string().min(1),
				password: z.string().min(1).regex(DATABASE_PASSWORD_REGEX, {
					message: DATABASE_PASSWORD_MESSAGE,
				}),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { mongoId, password } = input;
			await checkServicePermissionAndAccess(ctx, mongoId, {
				service: ["create"],
			});

			const mongo = await findMongoById(mongoId);
			const { appName, runtimeWorkerId, databaseUser, databasePassword } =
				mongo;

			const containerCmd = getServiceContainerCommand(appName);
			const command = `
				CONTAINER_ID=$(${containerCmd})
				if [ -z "$CONTAINER_ID" ]; then
					echo "No running container found for ${appName}" >&2
					exit 1
				fi
				docker exec "$CONTAINER_ID" mongosh -u '${databaseUser}' -p '${databasePassword}' --authenticationDatabase admin --eval "db.getSiblingDB('admin').changeUserPassword('${databaseUser}', '${password}')"
			`;

			await db.transaction(async (tx) => {
				await tx
					.update(mongoTable)
					.set({ databasePassword: password })
					.where(eq(mongoTable.mongoId, mongoId));

				if (runtimeWorkerId) {
					await execAsyncRemote(runtimeWorkerId, command);
				} else {
					await execAsync(command, { shell: "/bin/bash" });
				}
			});

			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: mongoId,
				resourceName: appName,
			});

			return true;
		}),
	move: protectedProcedure
		.input(
			z.object({
				mongoId: z.string(),
				targetEnvironmentId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				service: ["create"],
			});

			const updatedMongo = await db
				.update(mongoTable)
				.set({
					environmentId: input.targetEnvironmentId,
				})
				.where(eq(mongoTable.mongoId, input.mongoId))
				.returning()
				.then((res) => res[0]);

			if (!updatedMongo) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to move mongo",
				});
			}

			await audit(ctx, {
				action: "move",
				resourceType: "service",
				resourceId: updatedMongo.mongoId,
				resourceName: updatedMongo.appName,
			});
			return updatedMongo;
		}),
	rebuild: protectedProcedure
		.input(apiRebuildMongo)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.mongoId, {
				deployment: ["create"],
			});

			await rebuildDatabase(input.mongoId, "mongo");

			await audit(ctx, {
				action: "rebuild",
				resourceType: "service",
				resourceId: input.mongoId,
			});
			return true;
		}),
	search: protectedProcedure
		.input(
			z.object({
				q: z.string().optional(),
				name: z.string().optional(),
				appName: z.string().optional(),
				description: z.string().optional(),
				workspaceId: z.string().optional(),
				environmentId: z.string().optional(),
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
			if (input.environmentId) {
				baseConditions.push(eq(mongoTable.environmentId, input.environmentId));
			}
			if (input.q?.trim()) {
				const term = `%${input.q.trim()}%`;
				baseConditions.push(
					or(
						ilike(mongoTable.name, term),
						ilike(mongoTable.appName, term),
						ilike(mongoTable.description ?? "", term),
					)!,
				);
			}
			if (input.name?.trim()) {
				baseConditions.push(ilike(mongoTable.name, `%${input.name.trim()}%`));
			}
			if (input.appName?.trim()) {
				baseConditions.push(
					ilike(mongoTable.appName, `%${input.appName.trim()}%`),
				);
			}
			if (input.description?.trim()) {
				baseConditions.push(
					ilike(mongoTable.description ?? "", `%${input.description.trim()}%`),
				);
			}
			const { accessedServices } = await findMemberByUserId(
				ctx.user.id,
				ctx.session.activeOrganizationId,
			);
			if (accessedServices.length === 0) return { items: [], total: 0 };
			baseConditions.push(
				sql`${mongoTable.mongoId} IN (${sql.join(
					accessedServices.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			);

			const where = and(...baseConditions);
			const [items, countResult] = await Promise.all([
				db
					.select({
						mongoId: mongoTable.mongoId,
						name: mongoTable.name,
						appName: mongoTable.appName,
						description: mongoTable.description,
						environmentId: mongoTable.environmentId,
						applicationStatus: mongoTable.applicationStatus,
						createdAt: mongoTable.createdAt,
					})
					.from(mongoTable)
					.innerJoin(
						environments,
						eq(mongoTable.environmentId, environments.environmentId),
					)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where)
					.orderBy(desc(mongoTable.createdAt))
					.limit(input.limit)
					.offset(input.offset),
				db
					.select({ count: sql<number>`count(*)::int` })
					.from(mongoTable)
					.innerJoin(
						environments,
						eq(mongoTable.environmentId, environments.environmentId),
					)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where),
			]);
			return { items, total: countResult[0]?.count ?? 0 };
		}),

	readLogs: protectedProcedure
		.input(
			apiFindOneMongo.extend({
				tail: z.number().int().min(1).max(10000).default(100),
				since: z
					.string()
					.regex(/^(all|\d+[smhd])$/, "Invalid since format")
					.default("all"),
				search: z
					.string()
					.regex(/^[a-zA-Z0-9 ._-]{0,500}$/)
					.optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.mongoId, "read");
			const mongo = await findMongoById(input.mongoId);
			if (
				mongo.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this MongoDB",
				});
			}
			return await getContainerLogs(
				mongo.appName,
				input.tail,
				input.since,
				input.search,
				mongo.runtimeWorkerId,
			);
		}),
});
