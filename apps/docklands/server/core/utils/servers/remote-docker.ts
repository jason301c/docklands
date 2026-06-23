import Dockerode from "dockerode";
import { docker } from "@/server/core/constants/docker";
import { createLogger } from "@/server/core/lib/logger";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";

const logger = createLogger("docker");

export const getRemoteDocker = async (runtimeWorkerId?: string | null) => {
	if (!runtimeWorkerId) return docker;
	const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);
	if (!runtimeWorker.sshKeyId) return docker;
	logger.debug({ runtimeWorkerId }, "using remote Docker connection");
	const dockerode = new Dockerode({
		host: runtimeWorker.ipAddress,
		port: runtimeWorker.port,
		username: runtimeWorker.username,
		protocol: "ssh",
		sshOptions: {
			privateKey: runtimeWorker.sshKey?.privateKey,
		},
	});

	return dockerode;
};
