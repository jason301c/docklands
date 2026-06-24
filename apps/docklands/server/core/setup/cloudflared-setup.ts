import type { ContainerCreateOptions, CreateServiceOptions } from "dockerode";
import { createLogger } from "@/server/core/lib/logger";
import { getRemoteDocker } from "../utils/servers/remote-docker";

const logger = createLogger("setup:cloudflared");

// cloudflared is backward-compatible and auto-update is disabled, so the rolling
// `latest` tag is safe; pin via CLOUDFLARED_VERSION if a specific build is needed.
export const CLOUDFLARED_VERSION = process.env.CLOUDFLARED_VERSION || "latest";

const CONTAINER_NAME = "docklands-cloudflared";
const NETWORK = "docklands-network";

const imageName = () => `cloudflare/cloudflared:${CLOUDFLARED_VERSION}`;

/**
 * The cloudflared container is outbound-only: it connects to the Cloudflare edge
 * and forwards traffic to Traefik over the internal overlay network. It needs no
 * published ports, no bind mounts, and no Docker socket. The run token is passed
 * via the `TUNNEL_TOKEN` env var (not argv) so it does not appear in `ps`.
 */
const containerSpec = (token: string): ContainerCreateOptions => ({
	name: CONTAINER_NAME,
	Image: imageName(),
	Cmd: ["tunnel", "--no-autoupdate", "run"],
	Env: [`TUNNEL_TOKEN=${token}`],
	NetworkingConfig: {
		EndpointsConfig: {
			[NETWORK]: {},
		},
	},
	HostConfig: {
		RestartPolicy: { Name: "always" },
	},
});

const serviceSpec = (token: string): CreateServiceOptions => ({
	Name: CONTAINER_NAME,
	TaskTemplate: {
		ContainerSpec: {
			Image: imageName(),
			Args: ["tunnel", "--no-autoupdate", "run"],
			Env: [`TUNNEL_TOKEN=${token}`],
		},
		Networks: [{ Target: NETWORK }],
		Placement: {
			Constraints: ["node.role==manager"],
		},
	},
	Mode: { Replicated: { Replicas: 1 } },
});

const startStandalone = async (token: string, runtimeWorkerId?: string) => {
	const docker = await getRemoteDocker(runtimeWorkerId);
	try {
		await docker.pull(imageName());
		await new Promise((resolve) => setTimeout(resolve, 3000));
	} catch (err) {
		logger.error(
			{ err, image: imageName() },
			"Failed to pull cloudflared image — will try existing local image",
		);
	}
	try {
		await docker.getContainer(CONTAINER_NAME).remove({ force: true });
		await new Promise((resolve) => setTimeout(resolve, 2000));
	} catch (err) {
		logger.debug({ err }, "No existing cloudflared container to remove");
	}
	await docker.createContainer(containerSpec(token));
	await docker.getContainer(CONTAINER_NAME).start();
	logger.info({ container: CONTAINER_NAME }, "cloudflared container started");
};

const startService = async (token: string, runtimeWorkerId?: string) => {
	const docker = await getRemoteDocker(runtimeWorkerId);
	const spec = serviceSpec(token);
	try {
		const service = docker.getService(CONTAINER_NAME);
		const inspect = await service.inspect();
		await service.update({
			version: Number.parseInt(inspect.Version.Index, 10),
			...spec,
			TaskTemplate: {
				...spec.TaskTemplate,
				ForceUpdate: inspect.Spec.TaskTemplate.ForceUpdate + 1,
			},
		});
		logger.info({ service: CONTAINER_NAME }, "cloudflared service updated");
	} catch {
		await docker.createService(spec);
		logger.info({ service: CONTAINER_NAME }, "cloudflared service started");
	}
};

/**
 * Start (or restart) the managed cloudflared for the given tunnel token. Uses a
 * Swarm service in production and a standalone container in development, matching
 * how Traefik is run.
 */
export const startCloudflared = async (
	token: string,
	runtimeWorkerId?: string,
) => {
	if (process.env.NODE_ENV === "production") {
		await startService(token, runtimeWorkerId);
	} else {
		await startStandalone(token, runtimeWorkerId);
	}
};

/** Stop and remove the managed cloudflared (service or container). */
export const stopCloudflared = async (runtimeWorkerId?: string) => {
	const docker = await getRemoteDocker(runtimeWorkerId);
	try {
		await docker.getService(CONTAINER_NAME).remove();
		logger.info({ service: CONTAINER_NAME }, "cloudflared service removed");
		return;
	} catch (err) {
		logger.debug({ err }, "No cloudflared swarm service to remove");
	}
	try {
		await docker.getContainer(CONTAINER_NAME).remove({ force: true });
		logger.info({ container: CONTAINER_NAME }, "cloudflared container removed");
	} catch (err) {
		logger.debug({ err }, "No cloudflared container to remove");
	}
};
