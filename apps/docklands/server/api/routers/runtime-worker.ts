import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { and, desc, eq, getTableColumns, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { IS_CLOUD } from "@/server/core/constants/env";
import { db } from "@/server/core/db";
import {
	apiCreateRuntimeWorker,
	apiFindOneRuntimeWorker,
	apiRemoveRuntimeWorker,
	apiUpdateRuntimeWorker,
	apiUpdateRuntimeWorkerBuildsConcurrency,
	applications,
	compose,
	mariadb,
	mongo,
	mysql,
	organization,
	postgres,
	redis,
	runtimeWorkers,
} from "@/server/core/db/schema";
import { applyDockerCleanupSchedule } from "@/server/core/runtime/docker-cleanup";
import { getPublicIpWithFallback } from "@/server/core/runtime/host";
import { removeDeploymentsByRuntimeWorkerId } from "@/server/core/services/deployment";
import {
	createRuntimeWorker,
	deleteRuntimeWorker,
	findRuntimeWorkerById,
	getAccessibleRuntimeWorkerIds,
	haveActiveServices,
	updateRuntimeWorkerById,
} from "@/server/core/services/runtime-worker";
import { runtimeWorkerAudit } from "@/server/core/setup/runtime-worker-audit";
import {
	defaultCommand,
	runtimeWorkerSetup,
} from "@/server/core/setup/runtime-worker-setup";
import { runtimeWorkerValidate } from "@/server/core/setup/runtime-worker-validate";
import { assertBuildsConcurrencyAllowed } from "@/server/queues/concurrency";

export const runtimeWorkerRouter = createTRPCRouter({
	create: withPermission("runtimeWorker", "create")
		.input(apiCreateRuntimeWorker)
		.mutation(async ({ ctx, input }) => {
			try {
				const runtimeWorker = await createRuntimeWorker(
					input,
					ctx.session.activeOrganizationId,
				);
				await applyDockerCleanupSchedule(
					runtimeWorker.runtimeWorkerId,
					ctx.session.activeOrganizationId,
					input.enableDockerCleanup,
				);
				await audit(ctx, {
					action: "create",
					resourceType: "runtimeWorker",
					resourceId: runtimeWorker.runtimeWorkerId,
					resourceName: runtimeWorker.name,
				});
				return runtimeWorker;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error creating the runtime worker",
					cause: error,
				});
			}
		}),

	one: withPermission("runtimeWorker", "read")
		.input(apiFindOneRuntimeWorker)
		.query(async ({ input, ctx }) => {
			const runtimeWorker = await findRuntimeWorkerById(input.runtimeWorkerId);
			if (runtimeWorker.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this runtime worker",
				});
			}

			const accessibleIds = await getAccessibleRuntimeWorkerIds(ctx.session);
			if (!accessibleIds.has(input.runtimeWorkerId)) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this runtime worker",
				});
			}

			return runtimeWorker;
		}),
	getDefaultCommand: withPermission("runtimeWorker", "read")
		.input(apiFindOneRuntimeWorker)
		.query(async ({ input }) => {
			const runtimeWorker = await findRuntimeWorkerById(input.runtimeWorkerId);
			const isBuildServer = runtimeWorker.runtimeWorkerType === "build";
			return defaultCommand(isBuildServer);
		}),
	all: withPermission("runtimeWorker", "read").query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleRuntimeWorkerIds(ctx.session);

		const result = await db
			.select({
				...getTableColumns(runtimeWorkers),
				totalSum: sql<number>`cast(count(${applications.applicationId}) + count(${compose.composeId}) + count(${redis.redisId}) + count(${mariadb.mariadbId}) + count(${mongo.mongoId}) + count(${mysql.mysqlId}) + count(${postgres.postgresId}) as integer)`,
			})
			.from(runtimeWorkers)
			.leftJoin(
				applications,
				eq(applications.runtimeWorkerId, runtimeWorkers.runtimeWorkerId),
			)
			.leftJoin(
				compose,
				eq(compose.runtimeWorkerId, runtimeWorkers.runtimeWorkerId),
			)
			.leftJoin(
				redis,
				eq(redis.runtimeWorkerId, runtimeWorkers.runtimeWorkerId),
			)
			.leftJoin(
				mariadb,
				eq(mariadb.runtimeWorkerId, runtimeWorkers.runtimeWorkerId),
			)
			.leftJoin(
				mongo,
				eq(mongo.runtimeWorkerId, runtimeWorkers.runtimeWorkerId),
			)
			.leftJoin(
				mysql,
				eq(mysql.runtimeWorkerId, runtimeWorkers.runtimeWorkerId),
			)
			.leftJoin(
				postgres,
				eq(postgres.runtimeWorkerId, runtimeWorkers.runtimeWorkerId),
			)
			.where(
				eq(runtimeWorkers.organizationId, ctx.session.activeOrganizationId),
			)
			.orderBy(desc(runtimeWorkers.createdAt))
			.groupBy(runtimeWorkers.runtimeWorkerId);

		return result.filter((s) => accessibleIds.has(s.runtimeWorkerId));
	}),
	allForPermissions: withPermission("member", "update").query(
		async ({ ctx }) => {
			return await db.query.runtimeWorkers.findMany({
				columns: {
					runtimeWorkerId: true,
					name: true,
					ipAddress: true,
					runtimeWorkerType: true,
				},
				orderBy: desc(runtimeWorkers.createdAt),
				where: eq(
					runtimeWorkers.organizationId,
					ctx.session.activeOrganizationId,
				),
			});
		},
	),
	count: protectedProcedure.query(async ({ ctx }) => {
		const organizations = await db.query.organization.findMany({
			where: eq(organization.ownerId, ctx.user.id),
			with: {
				runtimeWorkers: true,
			},
		});

		const workers = organizations.flatMap((org) => org.runtimeWorkers);

		return workers.length ?? 0;
	}),
	withSSHKey: withPermission("runtimeWorker", "read").query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleRuntimeWorkerIds(ctx.session);

		const result = await db.query.runtimeWorkers.findMany({
			orderBy: desc(runtimeWorkers.createdAt),
			where: IS_CLOUD
				? and(
						isNotNull(runtimeWorkers.sshKeyId),
						eq(runtimeWorkers.organizationId, ctx.session.activeOrganizationId),
						eq(runtimeWorkers.runtimeWorkerStatus, "active"),
						eq(runtimeWorkers.runtimeWorkerType, "deploy"),
					)
				: and(
						isNotNull(runtimeWorkers.sshKeyId),
						eq(runtimeWorkers.organizationId, ctx.session.activeOrganizationId),
						eq(runtimeWorkers.runtimeWorkerType, "deploy"),
					),
		});
		return result.filter((s) => accessibleIds.has(s.runtimeWorkerId));
	}),
	buildWorkers: withPermission("runtimeWorker", "read").query(
		async ({ ctx }) => {
			const accessibleIds = await getAccessibleRuntimeWorkerIds(ctx.session);

			const result = await db.query.runtimeWorkers.findMany({
				orderBy: desc(runtimeWorkers.createdAt),
				where: IS_CLOUD
					? and(
							isNotNull(runtimeWorkers.sshKeyId),
							eq(
								runtimeWorkers.organizationId,
								ctx.session.activeOrganizationId,
							),
							eq(runtimeWorkers.runtimeWorkerStatus, "active"),
							eq(runtimeWorkers.runtimeWorkerType, "build"),
						)
					: and(
							isNotNull(runtimeWorkers.sshKeyId),
							eq(
								runtimeWorkers.organizationId,
								ctx.session.activeOrganizationId,
							),
							eq(runtimeWorkers.runtimeWorkerType, "build"),
						),
			});
			return result.filter((s) => accessibleIds.has(s.runtimeWorkerId));
		},
	),
	setup: withPermission("runtimeWorker", "create")
		.input(apiFindOneRuntimeWorker)
		.mutation(async ({ input, ctx }) => {
			try {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				if (runtimeWorker.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to set up this runtime worker",
					});
				}
				const setupResult = await runtimeWorkerSetup(input.runtimeWorkerId);
				await audit(ctx, {
					action: "update",
					resourceType: "runtimeWorker",
					resourceId: input.runtimeWorkerId,
					resourceName: runtimeWorker.name,
				});
				return setupResult;
			} catch (error) {
				throw error;
			}
		}),
	setupWithLogs: withPermission("runtimeWorker", "create")
		.meta({
			openapi: {
				path: "/deploy/server-with-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiFindOneRuntimeWorker)
		.subscription(async ({ input, ctx }) => {
			try {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				if (runtimeWorker.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to set up this runtime worker",
					});
				}
				return observable<string>((emit) => {
					runtimeWorkerSetup(input.runtimeWorkerId, (log) => {
						emit.next(log);
					});
				});
			} catch (error) {
				throw error;
			}
		}),
	validate: withPermission("runtimeWorker", "read")
		.input(apiFindOneRuntimeWorker)
		.query(async ({ input, ctx }) => {
			try {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				if (runtimeWorker.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to validate this runtime worker",
					});
				}
				const response = await runtimeWorkerValidate(input.runtimeWorkerId);
				return response as unknown as {
					docker: {
						enabled: boolean;
						version: string;
					};
					rclone: {
						enabled: boolean;
						version: string;
					};
					nixpacks: {
						enabled: boolean;
						version: string;
					};
					buildpacks: {
						enabled: boolean;
						version: string;
					};
					railpack: {
						enabled: boolean;
						version: string;
					};
					isDocklandsNetworkInstalled: boolean;
					isSwarmInstalled: boolean;
					isMainDirectoryInstalled: boolean;
					privilegeMode: string;
					dockerGroupMember: boolean;
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error?.message : `Error: ${error}`,
					cause: error as Error,
				});
			}
		}),

	security: withPermission("runtimeWorker", "read")
		.input(apiFindOneRuntimeWorker)
		.query(async ({ input, ctx }) => {
			try {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				if (runtimeWorker.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to validate this runtime worker",
					});
				}
				const response = await runtimeWorkerAudit(input.runtimeWorkerId);
				return response as unknown as {
					ufw: {
						installed: boolean;
						active: boolean;
						defaultIncoming: string;
					};
					ssh: {
						enabled: boolean;
						keyAuth: boolean;
						permitRootLogin: string;
						passwordAuth: string;
						usePam: string;
					};
					nonRootUser: {
						hasValidSudoUser: boolean;
					};
					unattendedUpgrades: {
						installed: boolean;
						active: boolean;
						updateEnabled: number;
						upgradeEnabled: number;
					};
					fail2ban: {
						installed: boolean;
						enabled: boolean;
						active: boolean;
						sshEnabled: string;
						sshMode: string;
					};
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: error instanceof Error ? error?.message : `Error: ${error}`,
					cause: error as Error,
				});
			}
		}),
	remove: withPermission("runtimeWorker", "delete")
		.input(apiRemoveRuntimeWorker)
		.mutation(async ({ input, ctx }) => {
			try {
				const hasActiveServices = await haveActiveServices(
					input.runtimeWorkerId,
				);

				if (hasActiveServices) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Runtime worker has active services, please delete them first",
					});
				}
				const currentRuntimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				await audit(ctx, {
					action: "delete",
					resourceType: "runtimeWorker",
					resourceId: currentRuntimeWorker.runtimeWorkerId,
					resourceName: currentRuntimeWorker.name,
				});
				await removeDeploymentsByRuntimeWorkerId(currentRuntimeWorker);
				await deleteRuntimeWorker(input.runtimeWorkerId);

				return currentRuntimeWorker;
			} catch (error) {
				throw error;
			}
		}),
	update: withPermission("runtimeWorker", "create")
		.input(apiUpdateRuntimeWorker)
		.mutation(async ({ input, ctx }) => {
			try {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				if (runtimeWorker.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to update this runtime worker",
					});
				}

				if (runtimeWorker.runtimeWorkerStatus === "inactive") {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Runtime worker is inactive",
					});
				}
				const updatedRuntimeWorker = await updateRuntimeWorkerById(
					input.runtimeWorkerId,
					{
						...input,
					},
				);

				await applyDockerCleanupSchedule(
					input.runtimeWorkerId,
					ctx.session.activeOrganizationId,
					input.enableDockerCleanup,
				);

				await audit(ctx, {
					action: "update",
					resourceType: "runtimeWorker",
					resourceId: input.runtimeWorkerId,
					resourceName: runtimeWorker.name,
				});
				return updatedRuntimeWorker;
			} catch (error) {
				throw error;
			}
		}),
	updateBuildsConcurrency: withPermission("runtimeWorker", "create")
		.input(apiUpdateRuntimeWorkerBuildsConcurrency)
		.mutation(async ({ input, ctx }) => {
			const currentRuntimeWorker = await findRuntimeWorkerById(
				input.runtimeWorkerId,
			);
			if (
				currentRuntimeWorker.organizationId !== ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to update this runtime worker",
				});
			}
			await assertBuildsConcurrencyAllowed(
				input.buildsConcurrency,
				ctx.session.activeOrganizationId,
			);
			return await updateRuntimeWorkerById(input.runtimeWorkerId, {
				buildsConcurrency: input.buildsConcurrency,
			});
		}),
	publicIp: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return "";
		}
		const ip = await getPublicIpWithFallback();
		return ip;
	}),
	getServerTime: protectedProcedure.query(() => {
		if (IS_CLOUD) {
			return null;
		}
		return {
			time: new Date(),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		};
	}),
	getServerMetrics: withPermission("monitoring", "read")
		.input(
			z.object({
				url: z.string(),
				token: z.string(),
				dataPoints: z.string(),
			}),
		)
		.query(async ({ input }) => {
			try {
				const url = new URL(input.url);
				url.searchParams.append("limit", input.dataPoints);
				const response = await fetch(url.toString(), {
					headers: {
						Authorization: `Bearer ${input.token}`,
					},
				});
				if (!response.ok) {
					throw new Error(
						`Error ${response.status}: ${response.statusText}. Ensure the container is running and this service is included in the monitoring configuration.`,
					);
				}

				const data = await response.json();
				if (!Array.isArray(data) || data.length === 0) {
					throw new Error(
						[
							"No monitoring data available. This could be because:",
							"",
							"1. You don't have setup the monitoring service, you can do in web server section.",
							"2. If you already have setup the monitoring service, wait a few minutes and refresh the page.",
						].join("\n"),
					);
				}
				return data as {
					cpu: string;
					cpuModel: string;
					cpuCores: number;
					cpuPhysicalCores: number;
					cpuSpeed: number;
					os: string;
					distro: string;
					kernel: string;
					arch: string;
					memUsed: string;
					memUsedGB: string;
					memTotal: string;
					uptime: number;
					diskUsed: string;
					totalDisk: string;
					networkIn: string;
					networkOut: string;
					timestamp: string;
				}[];
			} catch (error) {
				throw error;
			}
		}),
});
