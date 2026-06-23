import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import { deployments } from "@/server/core/db/schema/deployment";
import {
	createScheduleSchema,
	schedules,
	updateScheduleSchema,
} from "@/server/core/db/schema/schedule";
import {
	checkPermission,
	checkServicePermissionAndAccess,
	findMemberByUserId,
	isOwnerOrAdmin,
} from "@/server/core/services/permission";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import {
	createSchedule,
	deleteSchedule,
	findScheduleById,
	updateSchedule,
} from "@/server/core/services/schedule";
import {
	removeScheduleJob,
	runCommand,
	scheduleJob,
} from "@/server/core/utils/schedules/utils";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const scheduleRouter = createTRPCRouter({
	create: protectedProcedure
		.input(createScheduleSchema)
		.mutation(async ({ input, ctx }) => {
			const serviceId = input.applicationId || input.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					schedule: ["create"],
				});
			} else {
				await checkPermission(ctx, { schedule: ["create"] });

				if (
					input.scheduleType === "runtimeWorker" ||
					input.scheduleType === "docklands-server"
				) {
					const member = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);
					if (!isOwnerOrAdmin(member.role)) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"Only owners and admins can manage runtimeWorker-level schedules.",
						});
					}
				}

				if (input.scheduleType === "runtimeWorker" && input.runtimeWorkerId) {
					const targetRuntimeWorker = await findRuntimeWorkerById(
						input.runtimeWorkerId,
					);
					if (
						targetRuntimeWorker.organizationId !==
						ctx.session.activeOrganizationId
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this runtime worker.",
						});
					}
				}
			}
			const newSchedule = await createSchedule({
				...input,
				...(input.scheduleType === "docklands-server" && {
					organizationId: ctx.session.activeOrganizationId,
				}),
			});

			if (newSchedule?.enabled) {
				scheduleJob(newSchedule);
			}
			await audit(ctx, {
				action: "create",
				resourceType: "schedule",
				resourceId: newSchedule?.scheduleId,
				resourceName: newSchedule?.name,
			});
			return newSchedule;
		}),

	update: protectedProcedure
		.input(updateScheduleSchema)
		.mutation(async ({ input, ctx }) => {
			const existingSchedule = await findScheduleById(input.scheduleId);

			const serviceId =
				existingSchedule.applicationId || existingSchedule.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					schedule: ["update"],
				});
			} else {
				await checkPermission(ctx, { schedule: ["update"] });

				if (
					existingSchedule.scheduleType === "runtimeWorker" ||
					existingSchedule.scheduleType === "docklands-server"
				) {
					const member = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);
					if (!isOwnerOrAdmin(member.role)) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"Only owners and admins can manage runtimeWorker-level schedules.",
						});
					}
				}

				if (
					existingSchedule.scheduleType === "runtimeWorker" &&
					existingSchedule.runtimeWorkerId
				) {
					const targetRuntimeWorker = await findRuntimeWorkerById(
						existingSchedule.runtimeWorkerId,
					);
					if (
						targetRuntimeWorker.organizationId !==
						ctx.session.activeOrganizationId
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this runtime worker.",
						});
					}
				}
			}
			const updatedSchedule = await updateSchedule(input);

			if (updatedSchedule?.enabled) {
				removeScheduleJob(updatedSchedule.scheduleId);
				scheduleJob(updatedSchedule);
			} else {
				removeScheduleJob(updatedSchedule.scheduleId);
			}
			await audit(ctx, {
				action: "update",
				resourceType: "schedule",
				resourceId: updatedSchedule.scheduleId,
				resourceName: updatedSchedule.name,
			});
			return updatedSchedule;
		}),

	delete: protectedProcedure
		.input(z.object({ scheduleId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const scheduleItem = await findScheduleById(input.scheduleId);
			const serviceId = scheduleItem.applicationId || scheduleItem.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					schedule: ["delete"],
				});
			} else {
				await checkPermission(ctx, { schedule: ["delete"] });

				if (
					scheduleItem.scheduleType === "runtimeWorker" ||
					scheduleItem.scheduleType === "docklands-server"
				) {
					const member = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);
					if (!isOwnerOrAdmin(member.role)) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"Only owners and admins can manage runtimeWorker-level schedules.",
						});
					}
				}

				if (
					scheduleItem.scheduleType === "runtimeWorker" &&
					scheduleItem.runtimeWorkerId
				) {
					const targetRuntimeWorker = await findRuntimeWorkerById(
						scheduleItem.runtimeWorkerId,
					);
					if (
						targetRuntimeWorker.organizationId !==
						ctx.session.activeOrganizationId
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this runtime worker.",
						});
					}
				}
			}
			await deleteSchedule(input.scheduleId);

			removeScheduleJob(scheduleItem.scheduleId);
			await audit(ctx, {
				action: "delete",
				resourceType: "schedule",
				resourceId: scheduleItem.scheduleId,
				resourceName: scheduleItem.name,
			});
			return true;
		}),

	list: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				scheduleType: z.enum([
					"application",
					"compose",
					"runtimeWorker",
					"docklands-server",
				]),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (
				input.scheduleType === "application" ||
				input.scheduleType === "compose"
			) {
				await checkServicePermissionAndAccess(ctx, input.id, {
					schedule: ["read"],
				});
			} else {
				await checkPermission(ctx, { schedule: ["read"] });

				if (input.scheduleType === "runtimeWorker") {
					const targetRuntimeWorker = await findRuntimeWorkerById(input.id);
					if (
						targetRuntimeWorker.organizationId !==
						ctx.session.activeOrganizationId
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this runtime worker.",
						});
					}
				}

				if (input.scheduleType === "docklands-server") {
					const member = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);
					if (!isOwnerOrAdmin(member.role)) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message: "Only owners and admins can list host-level schedules.",
						});
					}
				}
			}
			const where = {
				application: eq(schedules.applicationId, input.id),
				compose: eq(schedules.composeId, input.id),
				runtimeWorker: eq(schedules.runtimeWorkerId, input.id),
				"docklands-server": eq(
					schedules.organizationId,
					ctx.session.activeOrganizationId,
				),
			};
			return db.query.schedules.findMany({
				where: where[input.scheduleType],
				orderBy: [asc(schedules.createdAt)],
				with: {
					application: true,
					runtimeWorker: true,
					compose: true,
					deployments: {
						orderBy: [desc(deployments.createdAt)],
					},
				},
			});
		}),

	one: protectedProcedure
		.input(z.object({ scheduleId: z.string() }))
		.query(async ({ input, ctx }) => {
			const schedule = await findScheduleById(input.scheduleId);
			const serviceId = schedule.applicationId || schedule.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					schedule: ["read"],
				});
			} else {
				await checkPermission(ctx, { schedule: ["read"] });

				if (
					schedule.scheduleType === "runtimeWorker" &&
					schedule.runtimeWorkerId
				) {
					const targetRuntimeWorker = await findRuntimeWorkerById(
						schedule.runtimeWorkerId,
					);
					if (
						targetRuntimeWorker.organizationId !==
						ctx.session.activeOrganizationId
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this schedule.",
						});
					}
				}
			}
			return schedule;
		}),

	runManually: protectedProcedure
		.input(z.object({ scheduleId: z.string().min(1) }))
		.mutation(async ({ input, ctx }) => {
			const scheduleItem = await findScheduleById(input.scheduleId);
			const serviceId = scheduleItem.applicationId || scheduleItem.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					schedule: ["create"],
				});
			} else {
				await checkPermission(ctx, { schedule: ["create"] });

				if (
					scheduleItem.scheduleType === "runtimeWorker" ||
					scheduleItem.scheduleType === "docklands-server"
				) {
					const member = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);
					if (!isOwnerOrAdmin(member.role)) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"Only owners and admins can manage runtimeWorker-level schedules.",
						});
					}
				}

				if (
					scheduleItem.scheduleType === "runtimeWorker" &&
					scheduleItem.runtimeWorkerId
				) {
					const targetRuntimeWorker = await findRuntimeWorkerById(
						scheduleItem.runtimeWorkerId,
					);
					if (
						targetRuntimeWorker.organizationId !==
						ctx.session.activeOrganizationId
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this runtime worker.",
						});
					}
				}
			}
			try {
				await runCommand(input.scheduleId);
				await audit(ctx, {
					action: "run",
					resourceType: "schedule",
					resourceId: input.scheduleId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						error instanceof Error ? error.message : "Error running schedule",
				});
			}
		}),
});
