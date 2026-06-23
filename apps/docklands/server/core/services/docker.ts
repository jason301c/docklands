import { createLogger } from "@/server/core/lib/logger";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";

const logger = createLogger("docker");

export const getContainers = async (runtimeWorkerId?: string | null) => {
	try {
		const command =
			"docker ps -a --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | Image: {{.Image}} | Ports: {{.Ports}} | State: {{.State}} | Status: {{.Status}}'";
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
			logger.warn({ stderr, runtimeWorkerId }, "docker ps stderr");
			return;
		}

		const lines = stdout.trim().split("\n");

		const containers = lines
			.map((line) => {
				const parts = line.split(" | ");
				const containerId = parts[0]
					? parts[0].replace("CONTAINER ID : ", "").trim()
					: "No container id";
				const name = parts[1]
					? parts[1].replace("Name: ", "").trim()
					: "No container name";
				const image = parts[2]
					? parts[2].replace("Image: ", "").trim()
					: "No image";
				const ports = parts[3]
					? parts[3].replace("Ports: ", "").trim()
					: "No ports";
				const state = parts[4]
					? parts[4].replace("State: ", "").trim()
					: "No state";
				const status = parts[5]
					? parts[5].replace("Status: ", "").trim()
					: "No status";
				return {
					containerId,
					name,
					image,
					ports,
					state,
					status,
					runtimeWorkerId,
				};
			})
			.filter(
				(container) =>
					!container.name.includes("docklands") ||
					container.name.includes("docklands-monitoring"),
			);

		return containers;
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "getContainers failed");
		return [];
	}
};

export const getConfig = async (
	containerId: string,
	runtimeWorkerId?: string | null,
) => {
	try {
		const command = `docker inspect ${containerId} --format='{{json .}}'`;
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
			logger.warn(
				{ stderr, containerId, runtimeWorkerId },
				"docker inspect stderr",
			);
			return;
		}

		const config = JSON.parse(stdout);

		return config;
	} catch (e) {
		logger.warn({ err: e, containerId }, "getConfig failed");
		return undefined;
	}
};

export const getContainersByAppNameMatch = async (
	appName: string,
	appType?: "stack" | "docker-compose",
	runtimeWorkerId?: string,
) => {
	try {
		let result: string[] = [];
		const cmd =
			"docker ps -a --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}} | Status: {{.Status}}'";

		const command =
			appType === "docker-compose"
				? `${cmd} --filter='label=com.docker.compose.workspace=${appName}'`
				: `${cmd} | grep '^.*Name: ${appName}'`;
		if (runtimeWorkerId) {
			const { stdout, stderr } = await execAsyncRemote(
				runtimeWorkerId,
				command,
			);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim()
				: "No state";

			const status = parts[3] ? parts[3].replace("Status: ", "").trim() : "";

			return {
				containerId,
				name,
				state,
				status,
			};
		});

		return containers || [];
	} catch (e) {
		logger.warn({ err: e, appName }, "getContainersByAppNameMatch failed");
	}

	return [];
};

export const getStackContainersByAppName = async (
	appName: string,
	runtimeWorkerId?: string,
) => {
	try {
		let result: string[] = [];

		const command = `docker stack ps ${appName} --no-trunc --format 'CONTAINER ID : {{.ID}} | Name: {{.Name}} | State: {{.DesiredState}} | Node: {{.Node}} | CurrentState: {{.CurrentState}} | Error: {{.Error}}'`;

		logger.debug({ command }, "getStackContainersByAppName command");
		if (runtimeWorkerId) {
			const { stdout, stderr } = await execAsyncRemote(
				runtimeWorkerId,
				command,
			);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim().toLowerCase()
				: "No state";
			const node = parts[3]
				? parts[3].replace("Node: ", "").trim()
				: "No specific node";
			const currentState = parts[4]
				? parts[4].replace("CurrentState: ", "").trim()
				: "";
			const error = parts[5] ? parts[5].replace("Error: ", "").trim() : "";
			return {
				containerId,
				name,
				state,
				node,
				currentState,
				error,
			};
		});

		return containers || [];
	} catch (e) {
		logger.warn({ err: e, appName }, "getStackContainersByAppName failed");
	}

	return [];
};

export const getServiceContainersByAppName = async (
	appName: string,
	runtimeWorkerId?: string,
) => {
	try {
		let result: string[] = [];

		const command = `docker service ps ${appName} --no-trunc --format 'CONTAINER ID : {{.ID}} | Name: {{.Name}} | State: {{.DesiredState}} | Node: {{.Node}} | CurrentState: {{.CurrentState}} | Error: {{.Error}}'`;
		if (runtimeWorkerId) {
			const { stdout, stderr } = await execAsyncRemote(
				runtimeWorkerId,
				command,
			);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim().toLowerCase()
				: "No state";

			const node = parts[3]
				? parts[3].replace("Node: ", "").trim()
				: "No specific node";

			const currentState = parts[4]
				? parts[4].replace("CurrentState: ", "").trim()
				: "";
			const error = parts[5] ? parts[5].replace("Error: ", "").trim() : "";
			return {
				containerId,
				name,
				state,
				currentState,
				node,
				error,
			};
		});

		return containers || [];
	} catch (e) {
		logger.warn({ err: e, appName }, "getServiceContainersByAppName failed");
	}

	return [];
};

export const getContainersByAppLabel = async (
	appName: string,
	type: "standalone" | "swarm",
	runtimeWorkerId?: string,
) => {
	try {
		let stdout = "";
		let stderr = "";

		const command =
			type === "swarm"
				? `docker ps --filter "label=com.docker.swarm.service.name=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`
				: type === "standalone"
					? `docker ps --filter "name=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`
					: `docker ps --filter "label=com.docker.compose.workspace=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`;
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
				{ stderr, appName, type, runtimeWorkerId },
				"getContainersByAppLabel stderr",
			);
			return;
		}

		if (!stdout) return [];

		const lines = stdout.trim().split("\n");

		const containers = lines.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";
			const state = parts[2]
				? parts[2].replace("State: ", "").trim()
				: "No state";
			return {
				containerId,
				name,
				state,
			};
		});

		return containers || [];
	} catch (e) {
		logger.warn({ err: e, appName, type }, "getContainersByAppLabel failed");
	}

	return [];
};

export const getContainerLogs = async (
	appNameOrId: string,
	tail = 100,
	since = "all",
	search?: string,
	runtimeWorkerId?: string | null,
	useContainerIdDirectly = false,
): Promise<string> => {
	const exec = (cmd: string) =>
		runtimeWorkerId ? execAsyncRemote(runtimeWorkerId, cmd) : execAsync(cmd);

	let target = appNameOrId;
	let isService = false;

	if (!useContainerIdDirectly) {
		// Find the real container ID by appName filter
		const findResult = await exec(
			`docker ps -q --filter "name=^${appNameOrId}" | head -1`,
		);
		const containerId = findResult.stdout.trim();

		if (!containerId) {
			// Fallback: try as a swarm service
			const svcResult = await exec(
				`docker service ls -q --filter "name=${appNameOrId}" | head -1`,
			);
			const serviceId = svcResult.stdout.trim();
			if (!serviceId) {
				throw new Error(`No container or service found for: ${appNameOrId}`);
			}
			isService = true;
		} else {
			target = containerId;
		}
	}

	const sinceFlag = since === "all" ? "" : `--since ${since}`;
	const baseCommand = isService
		? `docker service logs --timestamps --raw --tail ${tail} ${sinceFlag} ${target}`
		: `docker container logs --timestamps --tail ${tail} ${sinceFlag} ${target}`;

	const escapedSearch = search?.replace(/'/g, "'\\''") ?? "";
	const command = search
		? `${baseCommand} 2>&1 | grep -iF '${escapedSearch}'`
		: `${baseCommand} 2>&1`;

	try {
		const result = await exec(command);
		return result.stdout;
	} catch (error: unknown) {
		if (
			error &&
			typeof error === "object" &&
			"stdout" in error &&
			typeof (error as { stdout: string }).stdout === "string" &&
			(error as { stdout: string }).stdout.length > 0
		) {
			return (error as { stdout: string }).stdout;
		}
		throw error;
	}
};

export const containerRestart = async (
	containerId: string,
	runtimeWorkerId?: string,
) => {
	const command = `docker container restart ${containerId}`;
	const { stderr } = runtimeWorkerId
		? await execAsyncRemote(runtimeWorkerId, command)
		: await execAsync(command);

	if (stderr) {
		logger.error({ stderr, containerId }, "containerRestart stderr");
		throw new Error(stderr);
	}
};

export const containerStart = async (
	containerId: string,
	runtimeWorkerId?: string,
) => {
	const command = `docker container start ${containerId}`;
	const { stderr } = runtimeWorkerId
		? await execAsyncRemote(runtimeWorkerId, command)
		: await execAsync(command);

	if (stderr) {
		logger.error({ stderr, containerId }, "containerStart stderr");
		throw new Error(stderr);
	}
};

export const containerStop = async (
	containerId: string,
	runtimeWorkerId?: string,
) => {
	const command = `docker container stop ${containerId}`;
	const { stderr } = runtimeWorkerId
		? await execAsyncRemote(runtimeWorkerId, command)
		: await execAsync(command);

	if (stderr) {
		logger.error({ stderr, containerId }, "containerStop stderr");
		throw new Error(stderr);
	}
};

export const containerKill = async (
	containerId: string,
	runtimeWorkerId?: string,
) => {
	const command = `docker container kill ${containerId}`;
	const { stderr } = runtimeWorkerId
		? await execAsyncRemote(runtimeWorkerId, command)
		: await execAsync(command);

	if (stderr) {
		logger.error({ stderr, containerId }, "containerKill stderr");
		throw new Error(stderr);
	}
};

export const containerRemove = async (
	containerId: string,
	runtimeWorkerId?: string,
) => {
	const command = `docker rm -f ${containerId}`;
	const { stderr } = runtimeWorkerId
		? await execAsyncRemote(runtimeWorkerId, command)
		: await execAsync(command);

	if (stderr) {
		logger.error({ stderr, containerId }, "containerRemove stderr");
		throw new Error(stderr);
	}
};

export const getAllContainerStats = async (runtimeWorkerId?: string) => {
	try {
		let stdout = "";
		const command =
			'docker stats --no-stream --format \'{"BlockIO":"{{.BlockIO}}","CPUPerc":"{{.CPUPerc}}","Container":"{{.Container}}","ID":"{{.ID}}","MemPerc":"{{.MemPerc}}","MemUsage":"{{.MemUsage}}","Name":"{{.Name}}","NetIO":"{{.NetIO}}"}\'';

		if (runtimeWorkerId) {
			const result = await execAsyncRemote(runtimeWorkerId, command);
			stdout = result.stdout;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
		}

		if (!stdout.trim()) {
			return [];
		}

		const stats = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		return stats;
	} catch (error) {
		logger.error(
			{ err: error, runtimeWorkerId },
			"getAllContainerStats failed",
		);
		return [];
	}
};
