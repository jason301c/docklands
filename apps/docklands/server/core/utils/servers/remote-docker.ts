import Dockerode from "dockerode";
import { docker } from "@/server/core/constants/docker";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";

export const getRemoteDocker = async (runtimeWorkerId?: string | null) => {
	if (!runtimeWorkerId) return docker;
	const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);
	if (!runtimeWorker.sshKeyId) return docker;
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
