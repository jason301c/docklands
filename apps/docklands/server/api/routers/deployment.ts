import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import { apiFindAllByType, deployments } from "@/server/core/db/schema";
import {
	findDeploymentById,
	findDeploymentsCentralizedPaged,
	removeDeployment,
	resolveServicePath,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import {
	checkServicePermissionAndAccess,
	findMemberByUserId,
	isOwnerOrAdmin,
} from "@/server/core/services/permission";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import { myQueue } from "@/server/queues/queueSetup";
import { createTRPCRouter, protectedProcedure, withPermission } from "../trpc";

export const deploymentRouter = createTRPCRouter({
	allCentralizedPaged: withPermission("deployment", "read")
		.input(
			z.object({
				search: z.string().optional(),
				status: z
					.enum(["all", "running", "done", "error", "cancelled"])
					.default("all"),
				type: z.enum(["all", "application", "compose"]).default("all"),
				sortBy: z.enum(["createdAt", "status"]).default("createdAt"),
				sortDir: z.enum(["asc", "desc"]).default("desc"),
				limit: z.number().int().min(1).max(100).default(25),
				offset: z.number().int().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const orgId = ctx.session.activeOrganizationId;
			const accessedServices = !isOwnerOrAdmin(ctx.user.role)
				? (await findMemberByUserId(ctx.user.id, orgId)).accessedServices
				: null;
			return findDeploymentsCentralizedPaged(orgId, accessedServices, input);
		}),

	queueList: withPermission("deployment", "read").query(async ({ ctx }) => {
		const orgId = ctx.session.activeOrganizationId;
		const jobs = await myQueue.getJobs();
		const rows = await Promise.all(
			jobs.map(async (job) => {
				const state = await job.getState();
				return {
					id: String(job.id),
					name: job.name ?? undefined,
					data: job.data as Record<string, unknown>,
					timestamp: job.timestamp,
					processedOn: job.processedOn,
					finishedOn: job.finishedOn,
					failedReason: job.failedReason ?? undefined,
					state,
				};
			}),
		);
		rows.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

		return Promise.all(
			rows.map(async (row) => ({
				...row,
				servicePath: await resolveServicePath(
					orgId,
					(row.data ?? {}) as Record<string, unknown>,
				),
			})),
		);
	}),

	allByType: protectedProcedure
		.input(apiFindAllByType)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.id, {
				deployment: ["read"],
			});
			const deploymentsList = await db.query.deployments.findMany({
				where: eq(deployments[`${input.type}Id`], input.id),
				orderBy: desc(deployments.createdAt),
				with: {
					rollback: true,
				},
			});
			return deploymentsList;
		}),
	killProcess: protectedProcedure
		.input(
			z.object({
				deploymentId: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const deployment = await findDeploymentById(input.deploymentId);
			const serviceId = deployment.applicationId || deployment.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					deployment: ["cancel"],
				});
			}

			if (!deployment.pid) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Deployment is not running",
				});
			}

			const command = `kill -9 ${deployment.pid}`;
			if (deployment.runtimeWorkerId) {
				await execAsyncRemote(deployment.runtimeWorkerId, command);
			} else {
				await execAsync(command);
			}

			await updateDeploymentStatus(deployment.deploymentId, "error");
			await audit(ctx, {
				action: "cancel",
				resourceType: "deployment",
				resourceId: deployment.deploymentId,
			});
		}),

	removeDeployment: protectedProcedure
		.input(
			z.object({
				deploymentId: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const deployment = await findDeploymentById(input.deploymentId);
			const serviceId = deployment.applicationId || deployment.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					deployment: ["cancel"],
				});
			}
			const result = await removeDeployment(input.deploymentId);
			await audit(ctx, {
				action: "delete",
				resourceType: "deployment",
				resourceId: deployment.deploymentId,
			});
			return result;
		}),

	readLogs: protectedProcedure
		.input(
			z.object({
				deploymentId: z.string().min(1),
				tail: z.number().int().min(1).max(10000).default(100),
			}),
		)
		.query(async ({ input, ctx }) => {
			const deployment = await findDeploymentById(input.deploymentId);
			const serviceId = deployment.applicationId || deployment.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					deployment: ["read"],
				});
			}

			if (!deployment.logPath) {
				return "";
			}

			const command = `tail -n ${input.tail} "${deployment.logPath}" 2>/dev/null || echo ""`;
			const runtimeWorkerId = deployment.runtimeWorkerId;
			if (runtimeWorkerId) {
				const { stdout } = await execAsyncRemote(runtimeWorkerId, command);
				return stdout;
			}

			const { stdout } = await execAsync(command);
			return stdout;
		}),
});
