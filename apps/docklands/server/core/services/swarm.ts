import { createLogger } from "@/server/core/lib/logger";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";

const logger = createLogger("swarm");

export const getSwarmNodes = async (runtimeWorkerId?: string) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = "docker node ls --format '{{json .}}'";

		if (runtimeWorkerId) {
			const result = await execAsyncRemote(runtimeWorkerId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			logger.warn({ stderr, runtimeWorkerId }, "getSwarmNodes stderr");
			return;
		}

		const nodesArray = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		return nodesArray;
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "getSwarmNodes failed");
	}
};

export const getNodeInfo = async (nodeId: string, runtimeWorkerId?: string) => {
	try {
		const command = `docker node inspect ${nodeId} --format '{{json .}}'`;
		let stdout = "";
		let stderr = "";
		if (runtimeWorkerId) {
			const result = await execAsyncRemote(runtimeWorkerId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			logger.warn({ stderr, nodeId, runtimeWorkerId }, "getNodeInfo stderr");
			return;
		}

		const nodeInfo = JSON.parse(stdout);

		return nodeInfo;
	} catch (e) {
		logger.warn({ err: e, nodeId }, "getNodeInfo failed");
		return undefined;
	}
};

export const getNodeApplications = async (runtimeWorkerId?: string) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = `docker service ls --format '{{json .}}'`;

		if (runtimeWorkerId) {
			const result = await execAsyncRemote(runtimeWorkerId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);

			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			logger.warn({ stderr, runtimeWorkerId }, "getNodeApplications stderr");
			return;
		}

		if (!stdout.trim()) {
			return [];
		}

		const appArray = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line))
			.filter((service) => !service.Name.startsWith("docklands-"));

		return appArray;
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "getNodeApplications failed");
		return [];
	}
};

export const getApplicationInfo = async (
	appNames: string[],
	runtimeWorkerId?: string,
) => {
	if (appNames.length === 0) {
		return [];
	}
	try {
		let stdout = "";
		let stderr = "";
		const command = `docker service ps ${appNames.join(" ")} --format '{{json .}}' --no-trunc`;

		if (runtimeWorkerId) {
			const result = await execAsyncRemote(runtimeWorkerId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			logger.warn(
				{ stderr, appNames, runtimeWorkerId },
				"getApplicationInfo stderr",
			);
			return;
		}

		if (!stdout.trim()) {
			return [];
		}

		const appArray = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		return appArray;
	} catch (error) {
		logger.error({ err: error, appNames }, "getApplicationInfo failed");
		return [];
	}
};
