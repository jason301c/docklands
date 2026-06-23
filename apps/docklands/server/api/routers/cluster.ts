import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { getLocalServerIp } from "@/server/core/runtime/host";
import type { DockerNode } from "@/server/core/services/cluster";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import { getRemoteDocker } from "@/server/core/utils/servers/remote-docker";
import { createTRPCRouter, withPermission } from "../trpc";

// A Docker node reference (node ID or hostname). Restricting to this charset
// keeps `input.nodeId` safe to interpolate into the `docker node ...` commands
// that run locally or over SSH (no shell metacharacters).
const nodeIdRegex = /^[a-zA-Z0-9.\-_]+$/;

export const clusterRouter = createTRPCRouter({
	getNodes: withPermission("runtimeWorker", "read")
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.runtimeWorkerId) {
				const targetServer = await findRuntimeWorkerById(input.runtimeWorkerId);
				if (targetServer.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You don't have access to this runtime worker.",
					});
				}
			}
			const docker = await getRemoteDocker(input.runtimeWorkerId);
			const workers: DockerNode[] = await docker.listNodes();
			return workers;
		}),

	removeWorker: withPermission("runtimeWorker", "delete")
		.input(
			z.object({
				nodeId: z.string().min(1).regex(nodeIdRegex, "Invalid node id."),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.runtimeWorkerId) {
				const targetServer = await findRuntimeWorkerById(input.runtimeWorkerId);
				if (targetServer.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You don't have access to this runtime worker.",
					});
				}
			}
			// Quorum guard: force-removing a manager can break Raft quorum and take
			// the whole swarm offline. Inspect the node first (reusing the same
			// listNodes access getNodes uses) and refuse to remove a manager via
			// this path — managers must be demoted to workers first. `nodeId` may be
			// a node ID or a hostname, so match on either.
			const docker = await getRemoteDocker(input.runtimeWorkerId);
			const nodes: DockerNode[] = await docker.listNodes();
			const targetNode = nodes.find(
				(node) =>
					node.ID === input.nodeId ||
					node.Description?.Hostname === input.nodeId,
			);
			if (targetNode && targetNode.Spec.Role === "manager") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This node is a swarm manager. Removing a manager can break Raft " +
						"quorum and take the cluster offline. Demote it to a worker first, " +
						"then remove it.",
				});
			}
			try {
				const drainCommand = `docker node update --availability drain ${input.nodeId}`;
				const removeCommand = `docker node rm ${input.nodeId} --force`;

				if (input.runtimeWorkerId) {
					await execAsyncRemote(input.runtimeWorkerId, drainCommand);
					await execAsyncRemote(input.runtimeWorkerId, removeCommand);
				} else {
					await execAsync(drainCommand);
					await execAsync(removeCommand);
				}
				await audit(ctx, {
					action: "delete",
					resourceType: "cluster",
					resourceId: input.nodeId,
					resourceName: input.nodeId,
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Error removing the node",
					cause: error,
				});
			}
		}),

	addWorker: withPermission("runtimeWorker", "create")
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.runtimeWorkerId) {
				const targetServer = await findRuntimeWorkerById(input.runtimeWorkerId);
				if (targetServer.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You don't have access to this runtime worker.",
					});
				}
			}
			const docker = await getRemoteDocker(input.runtimeWorkerId);
			const result = await docker.swarmInspect();
			const docker_version = await docker.version();
			const info = await docker.info();

			const swarmNodeAddr = info?.Swarm?.NodeAddr;
			let ip = swarmNodeAddr || (await getLocalServerIp());
			if (!swarmNodeAddr && input.runtimeWorkerId) {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				ip = runtimeWorker?.ipAddress;
			}

			return {
				command: `docker swarm join --token ${result.JoinTokens.Worker} ${ip}:2377`,
				version: docker_version.Version,
			};
		}),

	addManager: withPermission("runtimeWorker", "create")
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			if (input.runtimeWorkerId) {
				const targetServer = await findRuntimeWorkerById(input.runtimeWorkerId);
				if (targetServer.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You don't have access to this runtime worker.",
					});
				}
			}
			const docker = await getRemoteDocker(input.runtimeWorkerId);
			const result = await docker.swarmInspect();
			const docker_version = await docker.version();
			const info = await docker.info();

			const swarmNodeAddr = info?.Swarm?.NodeAddr;
			let ip = swarmNodeAddr || (await getLocalServerIp());
			if (!swarmNodeAddr && input.runtimeWorkerId) {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				ip = runtimeWorker?.ipAddress;
			}
			return {
				command: `docker swarm join --token ${result.JoinTokens.Manager} ${ip}:2377`,
				version: docker_version.Version,
			};
		}),
});
