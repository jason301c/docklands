import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiChangeLibsqlStatus,
	apiCreateLibsql,
	apiDeployLibsql,
	apiFindOneLibsql,
	apiRebuildLibsql,
	apiResetLibsql,
	apiSaveEnvironmentVariablesLibsql,
	apiSaveExternalPortsLibsql,
	apiUpdateLibsql,
	libsql as libsqlTable,
} from "@/server/core/db/schema";
import { getContainerLogs } from "@/server/core/services/docker";
import { findEnvironmentById } from "@/server/core/services/environment";
import {
	createLibsql,
	deployLibsql,
	findLibsqlById,
	removeLibsqlById,
	updateLibsqlById,
} from "@/server/core/services/libsql";
import { createMount } from "@/server/core/services/mount";
import {
	addNewService,
	checkServiceAccess,
	checkServicePermissionAndAccess,
} from "@/server/core/services/permission";
import { getAccessibleRuntimeWorkerIds } from "@/server/core/services/runtime-worker";
import { checkPortInUse } from "@/server/core/services/settings";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { findWorkspaceById } from "@/server/core/services/workspace";
import { rebuildDatabase } from "@/server/core/utils/databases/rebuild";
import {
	removeService,
	startService,
	startServiceRemote,
	stopService,
	stopServiceRemote,
} from "@/server/core/utils/docker/utils";

export const libsqlRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateLibsql)
		.mutation(async ({ input, ctx }) => {
			try {
				const environment = await findEnvironmentById(input.environmentId);
				const workspace = await findWorkspaceById(environment.workspaceId);

				await checkServiceAccess(ctx, workspace.workspaceId, "create");

				const webServerSettings = await getWebServerSettings();
				if (webServerSettings?.remoteServersOnly && !input.runtimeWorkerId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You need to select a runtime worker to create a Libsql",
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

				const newLibsql = await createLibsql({
					...input,
				});
				await addNewService(ctx, newLibsql.libsqlId);

				await createMount({
					serviceId: newLibsql.libsqlId,
					serviceType: "libsql",
					volumeName: `${newLibsql.appName}-data`,
					mountPath: "/var/lib/sqld",
					type: "volume",
				});

				await audit(ctx, {
					action: "create",
					resourceType: "service",
					resourceId: newLibsql.libsqlId,
					resourceName: newLibsql.appName,
				});
				return true;
			} catch (error) {
				throw error;
			}
		}),
	one: protectedProcedure
		.input(apiFindOneLibsql)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.libsqlId, "read");

			const libsql = await findLibsqlById(input.libsqlId);
			if (
				libsql.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this Libsql",
				});
			}
			return libsql;
		}),

	start: protectedProcedure
		.input(apiFindOneLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				deployment: ["create"],
			});
			const libsql = await findLibsqlById(input.libsqlId);

			if (libsql.runtimeWorkerId) {
				await startServiceRemote(libsql.runtimeWorkerId, libsql.appName);
			} else {
				await startService(libsql.appName);
			}
			await updateLibsqlById(input.libsqlId, {
				applicationStatus: "done",
			});

			await audit(ctx, {
				action: "start",
				resourceType: "service",
				resourceId: libsql.libsqlId,
				resourceName: libsql.appName,
			});
			return libsql;
		}),
	stop: protectedProcedure
		.input(apiFindOneLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				deployment: ["create"],
			});
			const libsql = await findLibsqlById(input.libsqlId);

			if (libsql.runtimeWorkerId) {
				await stopServiceRemote(libsql.runtimeWorkerId, libsql.appName);
			} else {
				await stopService(libsql.appName);
			}
			await updateLibsqlById(input.libsqlId, {
				applicationStatus: "idle",
			});

			await audit(ctx, {
				action: "stop",
				resourceType: "service",
				resourceId: libsql.libsqlId,
				resourceName: libsql.appName,
			});
			return libsql;
		}),
	saveExternalPorts: protectedProcedure
		.input(apiSaveExternalPortsLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				service: ["create"],
			});
			const libsql = await findLibsqlById(input.libsqlId);

			if (libsql.sqldNode === "replica" && input.externalGRPCPort !== null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "externalGRPCPort cannot be set when sqldNode is 'replica'",
				});
			}

			const portsToCheck = [
				{
					port: input.externalPort,
					name: "externalPort",
					current: libsql.externalPort,
				},
				{
					port: input.externalGRPCPort,
					name: "externalGRPCPort",
					current: libsql.externalGRPCPort,
				},
				{
					port: input.externalAdminPort,
					name: "externalAdminPort",
					current: libsql.externalAdminPort,
				},
			];

			for (const { port, name, current } of portsToCheck) {
				if (port && port !== current) {
					const portCheck = await checkPortInUse(
						port,
						libsql.runtimeWorkerId || undefined,
					);
					if (portCheck.isInUse) {
						throw new TRPCError({
							code: "CONFLICT",
							message: `Port ${port} (${name}) is already in use by ${portCheck.conflictingContainer}`,
						});
					}
				}
			}

			await updateLibsqlById(input.libsqlId, {
				externalPort: input.externalPort,
				externalGRPCPort: input.externalGRPCPort,
				externalAdminPort: input.externalAdminPort,
			});
			await deployLibsql(input.libsqlId);
			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: libsql.libsqlId,
				resourceName: libsql.appName,
			});
			return libsql;
		}),
	deploy: protectedProcedure
		.input(apiDeployLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				deployment: ["create"],
			});
			const libsql = await findLibsqlById(input.libsqlId);
			await audit(ctx, {
				action: "deploy",
				resourceType: "service",
				resourceId: libsql.libsqlId,
				resourceName: libsql.appName,
			});
			return deployLibsql(input.libsqlId);
		}),
	deployWithLogs: protectedProcedure
		.meta({
			openapi: {
				path: "/deploy/libsql-with-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiDeployLibsql)
		.subscription(async function* ({ input, ctx, signal }) {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				deployment: ["create"],
			});
			const queue: string[] = [];
			let done = false;

			deployLibsql(input.libsqlId, (log) => {
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
		.input(apiChangeLibsqlStatus)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				deployment: ["create"],
			});
			const libsql = await findLibsqlById(input.libsqlId);
			await updateLibsqlById(input.libsqlId, {
				applicationStatus: input.applicationStatus,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: libsql.libsqlId,
				resourceName: libsql.appName,
			});
			return libsql;
		}),
	remove: protectedProcedure
		.input(apiFindOneLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.libsqlId, "delete");

			const libsql = await findLibsqlById(input.libsqlId);

			if (
				libsql.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to delete this Libsql",
				});
			}
			await audit(ctx, {
				action: "delete",
				resourceType: "service",
				resourceId: libsql.libsqlId,
				resourceName: libsql.appName,
			});
			const cleanupOperations = [
				async () =>
					await removeService(libsql?.appName, libsql.runtimeWorkerId),
				async () => await removeLibsqlById(input.libsqlId),
			];

			for (const operation of cleanupOperations) {
				try {
					await operation();
				} catch (_) {}
			}

			return libsql;
		}),
	saveEnvironment: protectedProcedure
		.input(apiSaveEnvironmentVariablesLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				envVars: ["write"],
			});
			const service = await updateLibsqlById(input.libsqlId, {
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
				resourceId: input.libsqlId,
			});
			return true;
		}),
	reload: protectedProcedure
		.input(apiResetLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				deployment: ["create"],
			});
			const libsql = await findLibsqlById(input.libsqlId);
			if (libsql.runtimeWorkerId) {
				await stopServiceRemote(libsql.runtimeWorkerId, libsql.appName);
			} else {
				await stopService(libsql.appName);
			}
			await updateLibsqlById(input.libsqlId, {
				applicationStatus: "idle",
			});

			if (libsql.runtimeWorkerId) {
				await startServiceRemote(libsql.runtimeWorkerId, libsql.appName);
			} else {
				await startService(libsql.appName);
			}
			await updateLibsqlById(input.libsqlId, {
				applicationStatus: "done",
			});
			await audit(ctx, {
				action: "reload",
				resourceType: "service",
				resourceId: libsql.libsqlId,
				resourceName: libsql.appName,
			});
			return true;
		}),
	update: protectedProcedure
		.input(apiUpdateLibsql)
		.mutation(async ({ input, ctx }) => {
			const { libsqlId, ...rest } = input;
			await checkServicePermissionAndAccess(ctx, libsqlId, {
				service: ["create"],
			});
			const libsql = await updateLibsqlById(libsqlId, {
				...rest,
			});

			if (!libsql) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error updating Libsql",
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "service",
				resourceId: libsqlId,
				resourceName: libsql.appName,
			});
			return true;
		}),
	move: protectedProcedure
		.input(
			z.object({
				libsqlId: z.string(),
				targetEnvironmentId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				service: ["create"],
			});

			const updatedLibsql = await db
				.update(libsqlTable)
				.set({
					environmentId: input.targetEnvironmentId,
				})
				.where(eq(libsqlTable.libsqlId, input.libsqlId))
				.returning()
				.then((res) => res[0]);

			if (!updatedLibsql) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to move libsql",
				});
			}

			await audit(ctx, {
				action: "move",
				resourceType: "service",
				resourceId: updatedLibsql.libsqlId,
				resourceName: updatedLibsql.appName,
			});
			return updatedLibsql;
		}),
	rebuild: protectedProcedure
		.input(apiRebuildLibsql)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.libsqlId, {
				deployment: ["create"],
			});

			await rebuildDatabase(input.libsqlId, "libsql");
			await audit(ctx, {
				action: "rebuild",
				resourceType: "service",
				resourceId: input.libsqlId,
			});
			return true;
		}),

	readLogs: protectedProcedure
		.input(
			apiFindOneLibsql.extend({
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
			await checkServiceAccess(ctx, input.libsqlId, "read");
			const libsql = await findLibsqlById(input.libsqlId);
			if (
				libsql.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this LibSQL",
				});
			}
			return await getContainerLogs(
				libsql.appName,
				input.tail,
				input.since,
				input.search,
				libsql.runtimeWorkerId,
			);
		}),
});
