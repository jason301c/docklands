import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	getAllContainerStats,
	getApplicationInfo,
	getNodeApplications,
	getNodeInfo,
	getSwarmNodes,
} from "@/server/core/services/docker";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { createTRPCRouter, withPermission } from "../trpc";
import { containerIdRegex } from "./docker";

export const swarmRouter = createTRPCRouter({
	getNodes: withPermission("runtimeWorker", "read")
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			return await getSwarmNodes(input.runtimeWorkerId);
		}),
	getNodeInfo: withPermission("runtimeWorker", "read")
		.input(
			z.object({ nodeId: z.string(), runtimeWorkerId: z.string().optional() }),
		)
		.query(async ({ input }) => {
			return await getNodeInfo(input.nodeId, input.runtimeWorkerId);
		}),
	getNodeApps: withPermission("runtimeWorker", "read")
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			return getNodeApplications(input.runtimeWorkerId);
		}),
	getAppInfos: withPermission("runtimeWorker", "read")
		.meta({
			openapi: {
				path: "/drop-deployment",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(
			z.object({
				appName: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid app name.")
					.array(),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			return await getApplicationInfo(input.appName, input.runtimeWorkerId);
		}),
	getContainerStats: withPermission("runtimeWorker", "read")
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.runtimeWorkerId) {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				if (
					runtimeWorker.organizationId !== ctx.session?.activeOrganizationId
				) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}
			return await getAllContainerStats(input.runtimeWorkerId);
		}),
});
