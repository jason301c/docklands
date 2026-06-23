import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	databaseChangePasswordCommand,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import { db } from "@/server/core/db";
import {
	apiChangeDatabaseStatus,
	apiCreateDatabase,
	apiDeployDatabase,
	apiFindOneDatabase,
	apiRebuildDatabase,
	apiResetDatabase,
	apiSaveEnvironmentVariablesDatabase,
	apiSaveExternalPortDatabase,
	apiUpdateDatabase,
	DATABASE_PASSWORD_MESSAGE,
	DATABASE_PASSWORD_REGEX,
	database as databaseTable,
	environments,
	workspaces,
} from "@/server/core/db/schema";
import {
	createDatabase,
	deployDatabase,
	findDatabaseById,
	getDatabaseMountPath,
	removeDatabaseById,
	updateDatabaseById,
} from "@/server/core/services/database";
import { getContainerLogs } from "@/server/core/services/docker";
import { findEnvironmentById } from "@/server/core/services/environment";
import { createDatabaseMount } from "@/server/core/services/mount";
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

export const databaseRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateDatabase)
		.mutation(async ({ input, ctx }) => {
			try {
				const environment = await findEnvironmentById(input.environmentId);
				const workspace = await findWorkspaceById(environment.workspaceId);

				await checkServiceAccess(ctx, workspace.workspaceId, "create");

				const webServerSettings = await getWebServerSettings();
				if (webServerSettings?.remoteServersOnly && !input.runtimeWorkerId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You need to select a runtime worker to create a database",
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

				const newDatabase = await createDatabase({ ...input });
				await addNewService(ctx, newDatabase.databaseId);

				await createDatabaseMount(newDatabase.databaseId, {
					volumeName: `${newDatabase.appName}-data`,
					mountPath: getDatabaseMountPath(
						newDatabase.engine,
						newDatabase.dockerImage,
					),
					type: "volume",
				});

				await audit(ctx, {
					action: "create",
					resourceType: "service",
					resourceId: newDatabase.databaseId,
					resourceName: newDatabase.appName,
				});
				return newDatabase;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error input: Inserting database",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOneDatabase)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.databaseId, "read");
			const service = await findDatabaseById(input.databaseId);
			if (
				service.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this database",
				});
			}
			return service;
		}),
	start: protectedProcedure
		.input(apiFindOneDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				deployment: ["create"],
			});
			const service = await findDatabaseById(input.databaseId);
			if (service.runtimeWorkerId) {
				await startServiceRemote(service.runtimeWorkerId, service.appName);
			} else {
				await startService(service.appName);
			}
			await updateDatabaseById(input.databaseId, { applicationStatus: "done" });
			await audit(ctx, {
				action: "start",
				resourceType: "service",
				resourceId: service.databaseId,
				resourceName: service.appName,
			});
			return service;
		}),
	stop: protectedProcedure
		.input(apiFindOneDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				deployment: ["create"],
			});
			const service = await findDatabaseById(input.databaseId);
			if (service.runtimeWorkerId) {
				await stopServiceRemote(service.runtimeWorkerId, service.appName);
			} else {
				await stopService(service.appName);
			}
			await updateDatabaseById(input.databaseId, { applicationStatus: "idle" });
			await audit(ctx, {
				action: "stop",
				resourceType: "service",
				resourceId: service.databaseId,
				resourceName: service.appName,
			});
			return service;
		}),
	saveExternalPort: protectedProcedure
		.input(apiSaveExternalPortDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				service: ["create"],
			});
			const service = await findDatabaseById(input.databaseId);
			if (input.externalPort) {
				const portCheck = await checkPortInUse(
					input.externalPort,
					service.runtimeWorkerId || undefined,
				);
				if (portCheck.isInUse) {
					throw new TRPCError({
						code: "CONFLICT",
						message: `Port ${input.externalPort} is already in use by ${portCheck.conflictingContainer}`,
					});
				}
			}
			await updateDatabaseById(input.databaseId, {
				externalPort: input.externalPort,
			});
			await deployDatabase(input.databaseId);
			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: service.databaseId,
				resourceName: service.appName,
			});
			return service;
		}),
	deploy: protectedProcedure
		.input(apiDeployDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				deployment: ["create"],
			});
			const service = await findDatabaseById(input.databaseId);
			await audit(ctx, {
				action: "deploy",
				resourceType: "service",
				resourceId: service.databaseId,
				resourceName: service.appName,
			});
			return deployDatabase(input.databaseId);
		}),
	deployWithLogs: protectedProcedure
		.meta({
			openapi: {
				path: "/deploy/database-with-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiDeployDatabase)
		.subscription(async function* ({ input, ctx, signal }) {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				deployment: ["create"],
			});
			const queue: string[] = [];
			let done = false;
			deployDatabase(input.databaseId, (log) => {
				queue.push(String(log));
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
				if (signal?.aborted) return;
			}
		}),
	changeStatus: protectedProcedure
		.input(apiChangeDatabaseStatus)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				deployment: ["create"],
			});
			const service = await findDatabaseById(input.databaseId);
			await updateDatabaseById(input.databaseId, {
				applicationStatus: input.applicationStatus,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: service.databaseId,
				resourceName: service.appName,
			});
			return service;
		}),
	remove: protectedProcedure
		.input(apiFindOneDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.databaseId, "delete");
			const service = await findDatabaseById(input.databaseId);
			if (
				service.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to delete this database",
				});
			}
			await audit(ctx, {
				action: "delete",
				resourceType: "service",
				resourceId: service.databaseId,
				resourceName: service.appName,
			});
			const cleanupOperations = [
				async () =>
					await removeService(service.appName, service.runtimeWorkerId),
				async () => await removeDatabaseById(input.databaseId),
			];
			for (const operation of cleanupOperations) {
				try {
					await operation();
				} catch (error) {
					// Best-effort cleanup: keep going, but surface failures so an
					// orphaned container/volume isn't left behind silently.
					console.error(
						`Failed to clean up database resource during delete for ${service.appName}:`,
						error,
					);
				}
			}
			return service;
		}),
	saveEnvironment: protectedProcedure
		.input(apiSaveEnvironmentVariablesDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				envVars: ["write"],
			});
			const service = await updateDatabaseById(input.databaseId, {
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
				resourceId: input.databaseId,
			});
			return true;
		}),
	reload: protectedProcedure
		.input(apiResetDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				deployment: ["create"],
			});
			const service = await findDatabaseById(input.databaseId);
			if (service.runtimeWorkerId) {
				await stopServiceRemote(service.runtimeWorkerId, service.appName);
			} else {
				await stopService(service.appName);
			}
			await updateDatabaseById(input.databaseId, { applicationStatus: "idle" });
			if (service.runtimeWorkerId) {
				await startServiceRemote(service.runtimeWorkerId, service.appName);
			} else {
				await startService(service.appName);
			}
			await updateDatabaseById(input.databaseId, { applicationStatus: "done" });
			await audit(ctx, {
				action: "reload",
				resourceType: "service",
				resourceId: service.databaseId,
				resourceName: service.appName,
			});
			return true;
		}),
	update: protectedProcedure
		.input(apiUpdateDatabase)
		.mutation(async ({ input, ctx }) => {
			const { databaseId, ...rest } = input;
			await checkServicePermissionAndAccess(ctx, databaseId, {
				service: ["create"],
			});
			const service = await updateDatabaseById(databaseId, {
				...rest,
			});
			if (!service) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error updating database",
				});
			}
			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: databaseId,
				resourceName: service.appName,
			});
			return true;
		}),
	changePassword: protectedProcedure
		.input(
			z.object({
				databaseId: z.string().min(1),
				password: z.string().min(1).regex(DATABASE_PASSWORD_REGEX, {
					message: DATABASE_PASSWORD_MESSAGE,
				}),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { databaseId, password } = input;
			await checkServicePermissionAndAccess(ctx, databaseId, {
				service: ["create"],
			});

			const service = await findDatabaseById(databaseId);
			const config = parseDatabaseConfig(service.engine, service.config) as {
				databaseUser?: string;
				databasePassword: string;
				databaseRootPassword?: string;
			};

			const inner = databaseChangePasswordCommand(service.engine, {
				databaseUser: config.databaseUser ?? "",
				databasePassword: config.databasePassword,
				databaseRootPassword: config.databaseRootPassword,
				newPassword: password,
			});
			if (!inner) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Password change is not supported for ${service.engine}`,
				});
			}

			const containerCmd = getServiceContainerCommand(service.appName);
			const command = `
				CONTAINER_ID=$(${containerCmd})
				if [ -z "$CONTAINER_ID" ]; then
					echo "No running container found for ${service.appName}" >&2
					exit 1
				fi
				${inner}
			`;

			await db.transaction(async (tx) => {
				await tx
					.update(databaseTable)
					.set({ config: { ...config, databasePassword: password } })
					.where(eq(databaseTable.databaseId, databaseId));
				if (service.runtimeWorkerId) {
					await execAsyncRemote(service.runtimeWorkerId, command);
				} else {
					await execAsync(command, { shell: "/bin/bash" });
				}
			});

			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: databaseId,
				resourceName: service.appName,
			});
			return true;
		}),
	move: protectedProcedure
		.input(
			z.object({
				databaseId: z.string(),
				targetEnvironmentId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				service: ["create"],
			});
			const updated = await db
				.update(databaseTable)
				.set({ environmentId: input.targetEnvironmentId })
				.where(eq(databaseTable.databaseId, input.databaseId))
				.returning()
				.then((res) => res[0]);
			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to move database",
				});
			}
			await audit(ctx, {
				action: "move",
				resourceType: "service",
				resourceId: updated.databaseId,
				resourceName: updated.appName,
			});
			return updated;
		}),
	rebuild: protectedProcedure
		.input(apiRebuildDatabase)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.databaseId, {
				deployment: ["create"],
			});
			const service = await findDatabaseById(input.databaseId);
			await removeService(service.appName, service.runtimeWorkerId);
			await new Promise((resolve) => setTimeout(resolve, 6000));
			for (const mount of service.mounts) {
				if (mount.type === "volume") {
					const command = `docker volume rm ${mount?.volumeName} --force`;
					if (service.runtimeWorkerId) {
						await execAsyncRemote(service.runtimeWorkerId, command);
					} else {
						await execAsync(command);
					}
				}
			}
			await deployDatabase(input.databaseId);
			await audit(ctx, {
				action: "rebuild",
				resourceType: "service",
				resourceId: input.databaseId,
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
				baseConditions.push(
					eq(databaseTable.environmentId, input.environmentId),
				);
			}
			if (input.q?.trim()) {
				const term = `%${input.q.trim()}%`;
				baseConditions.push(
					or(
						ilike(databaseTable.name, term),
						ilike(databaseTable.appName, term),
						ilike(databaseTable.description ?? "", term),
					)!,
				);
			}
			if (input.name?.trim()) {
				baseConditions.push(
					ilike(databaseTable.name, `%${input.name.trim()}%`),
				);
			}
			if (input.appName?.trim()) {
				baseConditions.push(
					ilike(databaseTable.appName, `%${input.appName.trim()}%`),
				);
			}
			if (input.description?.trim()) {
				baseConditions.push(
					ilike(
						databaseTable.description ?? "",
						`%${input.description.trim()}%`,
					),
				);
			}
			const { accessedServices } = await findMemberByUserId(
				ctx.user.id,
				ctx.session.activeOrganizationId,
			);
			if (accessedServices.length === 0) return { items: [], total: 0 };
			baseConditions.push(
				sql`${databaseTable.databaseId} IN (${sql.join(
					accessedServices.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			);

			const where = and(...baseConditions);
			const [items, countResult] = await Promise.all([
				db
					.select({
						databaseId: databaseTable.databaseId,
						engine: databaseTable.engine,
						name: databaseTable.name,
						appName: databaseTable.appName,
						description: databaseTable.description,
						environmentId: databaseTable.environmentId,
						applicationStatus: databaseTable.applicationStatus,
						createdAt: databaseTable.createdAt,
					})
					.from(databaseTable)
					.innerJoin(
						environments,
						eq(databaseTable.environmentId, environments.environmentId),
					)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where)
					.orderBy(desc(databaseTable.createdAt))
					.limit(input.limit)
					.offset(input.offset),
				db
					.select({ count: sql<number>`count(*)::int` })
					.from(databaseTable)
					.innerJoin(
						environments,
						eq(databaseTable.environmentId, environments.environmentId),
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
			apiFindOneDatabase.extend({
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
			await checkServiceAccess(ctx, input.databaseId, "read");
			const service = await findDatabaseById(input.databaseId);
			if (
				service.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this database",
				});
			}
			return await getContainerLogs(
				service.appName,
				input.tail,
				input.since,
				input.search,
				service.runtimeWorkerId,
			);
		}),
});
