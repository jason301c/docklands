import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import {
	containerKill,
	containerRemove,
	containerRestart,
	containerStart,
	containerStop,
	getConfig,
	getContainers,
	getContainersByAppLabel,
	getContainersByAppNameMatch,
	getServiceContainersByAppName,
	getStackContainersByAppName,
} from "@/server/core/services/docker";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { uploadFileToContainer } from "@/server/core/utils/docker/file-upload";
import { uploadFileToContainerSchema } from "@/shared/validation/schema";
import { createTRPCRouter, withPermission } from "../trpc";

export const containerIdRegex = /^[a-zA-Z0-9.\-_]+$/;

export const dockerRouter = createTRPCRouter({
	getContainers: withPermission("docker", "read")
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
			return await getContainers(input.runtimeWorkerId);
		}),

	restartContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
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
			await containerRestart(input.containerId, input.runtimeWorkerId);
			await audit(ctx, {
				action: "start",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	startContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
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
			await containerStart(input.containerId, input.runtimeWorkerId);
			await audit(ctx, {
				action: "start",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	stopContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
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
			await containerStop(input.containerId, input.runtimeWorkerId);
			await audit(ctx, {
				action: "stop",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	killContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
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
			await containerKill(input.containerId, input.runtimeWorkerId);
			await audit(ctx, {
				action: "stop",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	removeContainer: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
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
			await containerRemove(input.containerId, input.runtimeWorkerId);
			await audit(ctx, {
				action: "delete",
				resourceType: "docker",
				resourceId: input.containerId,
				resourceName: input.containerId,
			});
		}),

	getConfig: withPermission("docker", "read")
		.input(
			z.object({
				containerId: z
					.string()
					.min(1)
					.regex(containerIdRegex, "Invalid container id."),
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
			return await getConfig(input.containerId, input.runtimeWorkerId);
		}),

	getContainersByAppNameMatch: withPermission("service", "read")
		.input(
			z.object({
				appType: z.enum(["stack", "docker-compose"]).optional(),
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
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
			return await getContainersByAppNameMatch(
				input.appName,
				input.appType,
				input.runtimeWorkerId,
			);
		}),

	getContainersByAppLabel: withPermission("docker", "read")
		.input(
			z.object({
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
				runtimeWorkerId: z.string().optional(),
				type: z.enum(["standalone", "swarm"]),
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
			return await getContainersByAppLabel(
				input.appName,
				input.type,
				input.runtimeWorkerId,
			);
		}),

	getStackContainersByAppName: withPermission("docker", "read")
		.input(
			z.object({
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
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
			return await getStackContainersByAppName(
				input.appName,
				input.runtimeWorkerId,
			);
		}),

	getServiceContainersByAppName: withPermission("docker", "read")
		.input(
			z.object({
				appName: z.string().min(1).regex(containerIdRegex, "Invalid app name."),
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
			return await getServiceContainersByAppName(
				input.appName,
				input.runtimeWorkerId,
			);
		}),

	uploadFileToContainer: withPermission("docker", "read")
		.input(uploadFileToContainerSchema)
		.mutation(async ({ input, ctx }) => {
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

			const file = input.file;
			if (!(file instanceof File)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid file provided",
				});
			}

			// Convert File to Buffer
			const arrayBuffer = await file.arrayBuffer();
			const fileBuffer = Buffer.from(arrayBuffer);

			await uploadFileToContainer(
				input.containerId,
				fileBuffer,
				file.name,
				input.destinationPath,
				input.runtimeWorkerId || null,
			);

			return { success: true, message: "File uploaded successfully" };
		}),
});
