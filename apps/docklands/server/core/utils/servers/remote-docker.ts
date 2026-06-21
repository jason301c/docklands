import Dockerode from "dockerode";
import { docker } from "@/server/core/constants/docker";
import { findServerById } from "@/server/core/services/server";

export const getRemoteDocker = async (serverId?: string | null) => {
	if (!serverId) return docker;
	const server = await findServerById(serverId);
	if (!server.sshKeyId) return docker;
	const dockerode = new Dockerode({
		host: server.ipAddress,
		port: server.port,
		username: server.username,
		protocol: "ssh",
		sshOptions: {
			privateKey: server.sshKey?.privateKey,
		},
	});

	return dockerode;
};
