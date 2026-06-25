import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import type { ContainerInfo, ResourceRequirements } from "dockerode";
import { parse } from "dotenv";
import { quote } from "shell-quote";
import { docker } from "@/server/core/constants/docker";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";
import type { Compose } from "@/server/core/services/compose";
import {
	FILE_MOUNT_PATH_ERROR,
	isSafeRelativeFileMountPath,
} from "@/shared/validation/mount-file-path";
import type { ApplicationNested } from "../builders";
import type { DatabaseNested } from "../databases/build";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { spawnAsync } from "../process/spawnAsync";
import { getRemoteDocker } from "../servers/remote-docker";

const logger = createLogger("docker");

interface RegistryAuth {
	username: string;
	password: string;
	registryUrl: string;
}

export const pullImage = async (
	dockerImage: string,
	onData?: (data: any) => void,
	authConfig?: Partial<RegistryAuth>,
): Promise<void> => {
	if (!dockerImage) {
		throw new Error("Docker image not found");
	}

	logger.info({ image: dockerImage }, "pulling image");

	if (authConfig?.username && authConfig?.password) {
		await spawnAsync(
			"docker",
			[
				"login",
				authConfig.registryUrl || "",
				"-u",
				authConfig.username,
				"-p",
				authConfig.password,
			],
			onData,
		);
	}
	await spawnAsync("docker", ["pull", dockerImage], onData);
};

export const pullRemoteImage = async (
	dockerImage: string,
	runtimeWorkerId: string,
	onData?: (data: any) => void,
	authConfig?: Partial<RegistryAuth>,
): Promise<void> => {
	if (!dockerImage) {
		throw new Error("Docker image not found");
	}

	logger.info({ image: dockerImage, runtimeWorkerId }, "pulling remote image");

	const remoteDocker = await getRemoteDocker(runtimeWorkerId);

	await new Promise((resolve, reject) => {
		remoteDocker.pull(
			dockerImage,
			{ authconfig: authConfig },
			(err, stream) => {
				if (err) {
					reject(err);
					return;
				}

				remoteDocker.modem.followProgress(
					stream as Readable,
					(err: Error | null, res) => {
						if (!err) {
							resolve(res);
						}
						if (err) {
							reject(err);
						}
					},
					(event) => {
						onData?.(event);
					},
				);
			},
		);
	});
};

export const containerExists = async (containerName: string) => {
	const container = docker.getContainer(containerName);
	try {
		await container.inspect();
		return true;
	} catch {
		return false;
	}
};

export const stopService = async (appName: string) => {
	try {
		await execAsync(`docker service scale ${appName}=0 `);
	} catch (error) {
		logger.error({ err: error, appName }, "failed to stop service");
		throw error;
	}
};

export const stopServiceRemote = async (
	runtimeWorkerId: string,
	appName: string,
) => {
	try {
		await execAsyncRemote(
			runtimeWorkerId,
			`docker service scale ${appName}=0 `,
		);
	} catch (error) {
		logger.error(
			{ err: error, appName, runtimeWorkerId },
			"failed to stop remote service",
		);
		throw error;
	}
};

export const getContainerByName = (name: string): Promise<ContainerInfo> => {
	const opts = {
		limit: 1,
		filters: {
			name: [name],
		},
	};
	return new Promise((resolve, reject) => {
		docker.listContainers(opts, (err, containers) => {
			if (err) {
				reject(err);
			} else if (containers?.length === 0) {
				reject(new Error(`No container found with name: ${name}`));
			} else if (containers && containers?.length > 0 && containers[0]) {
				resolve(containers[0]);
			}
		});
	});
};

/**
 * Docker commands sent using this method are held in a hold when Docker is busy.
 *
 * This avoids racing Docker while another Docker command is already active.
 */
export const dockerSafeExec = (exec: string) => `
CHECK_INTERVAL=10

echo "Preparing for execution..."

while true; do
    PROCESSES=$(ps aux | grep -E "^.*docker [A-Za-z]" | grep -v grep)

    if [ -z "$PROCESSES" ]; then
        echo "Docker is idle. Starting execution..."
        break
    else
        echo "Docker is busy. Will check again in $CHECK_INTERVAL seconds..."
        sleep $CHECK_INTERVAL
    fi
done

${exec}

echo "Execution completed."
`;

const cleanupCommands = {
	containers: "docker container prune --force",
	images: "docker image prune --all --force",
	volumes: "docker volume prune --all --force",
	builders: "docker builder prune --all --force",
	system: "docker system prune --all --force",
};

export const cleanupContainers = async (runtimeWorkerId?: string) => {
	try {
		const command = cleanupCommands.containers;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, dockerSafeExec(command));
		} else {
			await execAsync(dockerSafeExec(command));
		}
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "cleanupContainers failed");
		throw error;
	}
};

export const cleanupImages = async (runtimeWorkerId?: string) => {
	try {
		const command = cleanupCommands.images;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, dockerSafeExec(command));
		} else await execAsync(dockerSafeExec(command));
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "cleanupImages failed");
		throw error;
	}
};

export const cleanupVolumes = async (runtimeWorkerId?: string) => {
	try {
		const command = cleanupCommands.volumes;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, dockerSafeExec(command));
		} else {
			await execAsync(dockerSafeExec(command));
		}
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "cleanupVolumes failed");
		throw error;
	}
};

export const cleanupBuilders = async (runtimeWorkerId?: string) => {
	try {
		const command = cleanupCommands.builders;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, dockerSafeExec(command));
		} else {
			await execAsync(dockerSafeExec(command));
		}
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "cleanupBuilders failed");
		throw error;
	}
};

export const cleanupSystem = async (runtimeWorkerId?: string) => {
	try {
		const command = cleanupCommands.system;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, dockerSafeExec(command));
		} else {
			await execAsync(dockerSafeExec(command));
		}
	} catch (error) {
		logger.error({ err: error, runtimeWorkerId }, "cleanupSystem failed");
		throw error;
	}
};

export interface DockerDiskUsageItem {
	type: string;
	totalCount: number;
	active: number;
	size: string;
	reclaimable: string;
	sizeBytes: number;
}

const parseSizeToBytes = (size: string): number => {
	const match = size.match(/^([\d.]+)\s*([KMGT]?B)$/i);
	if (!match) return 0;
	const value = Number.parseFloat(match[1] as string);
	const unit = (match[2] as string).toUpperCase();
	const multipliers: Record<string, number> = {
		B: 1,
		KB: 1024,
		MB: 1024 ** 2,
		GB: 1024 ** 3,
		TB: 1024 ** 4,
	};
	return value * (multipliers[unit] || 0);
};

export const getDockerDiskUsage = async (): Promise<DockerDiskUsageItem[]> => {
	const command = "docker system df --format '{{json .}}'";
	const { stdout } = await execAsync(command);

	const lines = stdout.trim().split("\n").filter(Boolean);
	return lines.map((line) => {
		const data = JSON.parse(line);
		return {
			type: data.Type,
			totalCount: Number.parseInt(data.TotalCount, 10) || 0,
			active: Number.parseInt(data.Active, 10) || 0,
			size: data.Size,
			reclaimable: data.Reclaimable,
			sizeBytes: parseSizeToBytes(data.Size),
		};
	});
};

/**
 * Volume cleanup should always be performed manually by the user. The reason is that during automatic cleanup, a volume may be deleted due to a stopped container, which is a dangerous situation.
 *
 * Automatic cleanup can delete volumes from stopped containers.
 */
const excludedCleanupAllCommands: (keyof typeof cleanupCommands)[] = [
	"volumes",
];

export const cleanupAll = async (runtimeWorkerId?: string) => {
	for (const [key, command] of Object.entries(cleanupCommands) as [
		keyof typeof cleanupCommands,
		string,
	][]) {
		if (excludedCleanupAllCommands.includes(key)) continue;

		try {
			if (runtimeWorkerId) {
				await execAsyncRemote(runtimeWorkerId, dockerSafeExec(command));
			} else {
				await execAsync(dockerSafeExec(command));
			}
		} catch (err) {
			logger.warn(
				{ err, key, runtimeWorkerId },
				"cleanup operation failed, continuing",
			);
		}
	}
};

export const cleanupAllBackground = async (runtimeWorkerId?: string) => {
	Promise.allSettled(
		(
			Object.entries(cleanupCommands) as [
				keyof typeof cleanupCommands,
				string,
			][]
		)
			.filter(([key]) => !excludedCleanupAllCommands.includes(key))
			.map(async ([, command]) => {
				if (runtimeWorkerId) {
					await execAsyncRemote(runtimeWorkerId, dockerSafeExec(command));
				} else {
					await execAsync(dockerSafeExec(command));
				}
			}),
	)
		.then((results) => {
			const failed = results.filter((r) => r.status === "rejected");
			if (failed.length > 0) {
				logger.error(
					{ failedCount: failed.length, runtimeWorkerId },
					"Docker cleanup: some operations failed",
				);
			} else {
				logger.debug(
					{ runtimeWorkerId },
					"Docker cleanup completed successfully",
				);
			}
		})
		.catch((error) =>
			logger.error(
				{ err: error, runtimeWorkerId },
				"Docker cleanup allSettled failed",
			),
		);

	return {
		status: "scheduled",
		message: "Docker cleanup has been initiated in the background",
	};
};

export const startService = async (appName: string) => {
	try {
		await execAsync(`docker service scale ${appName}=1 `);
	} catch (error) {
		logger.error({ err: error, appName }, "failed to start service");
		throw error;
	}
};

export const startServiceRemote = async (
	runtimeWorkerId: string,
	appName: string,
) => {
	try {
		await execAsyncRemote(
			runtimeWorkerId,
			`docker service scale ${appName}=1 `,
		);
	} catch (error) {
		logger.error(
			{ err: error, appName, runtimeWorkerId },
			"failed to start remote service",
		);
		throw error;
	}
};

export const removeService = async (
	appName: string,
	runtimeWorkerId?: string | null,
	_deleteVolumes = false,
) => {
	try {
		const command = `docker service rm ${appName}`;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	} catch (error) {
		logger.error(
			{ err: error, appName, runtimeWorkerId },
			"failed to remove Docker service",
		);
		throw error;
	}
};

export const prepareEnvironmentVariables = (
	serviceEnv: string | null,
	projectEnv?: string | null,
	environmentEnv?: string | null,
) => {
	const workspaceVars = parse(projectEnv ?? "");
	const environmentVars = parse(environmentEnv ?? "");
	const serviceVars = parse(serviceEnv ?? "");

	// Inheritance cascade. The workspace env store is the base layer, the
	// environment store overrides it, and the service's own variables override
	// both — so a variable set once at the workspace or environment level is
	// inherited by every service unless that service sets its own value.
	// Generated connection variables already live in the service layer, so they
	// win over inherited values too. The `${{workspace.X}}` / `${{environment.Y}}`
	// reference syntax stays as an escape hatch for renaming or composing a value
	// as it flows down (e.g. exposing workspace.DB_HOST under a different key).
	const mergedVars: Record<string, string> = {
		...workspaceVars,
		...environmentVars,
		...serviceVars,
	};
	// Output order: the service's own variables first (as the user wrote them),
	// then inherited environment-only variables, then inherited workspace-only
	// variables. Functionally the env is a set; this just keeps output stable.
	const orderedKeys = [
		...Object.keys(serviceVars),
		...Object.keys(environmentVars).filter((key) => !(key in serviceVars)),
		...Object.keys(workspaceVars).filter(
			(key) => !(key in serviceVars) && !(key in environmentVars),
		),
	];

	const resolvedVars = orderedKeys.map((key) => {
		let resolvedValue = mergedVars[key] ?? "";

		// Replace variables backed by the workspace env store.
		resolvedValue = resolvedValue.replace(
			/\$\{\{workspace\.(.*?)\}\}/g,
			(_, ref) => {
				if (workspaceVars[ref] !== undefined) {
					return workspaceVars[ref];
				}
				throw new Error(
					`Invalid workspace environment variable: workspace.${ref}`,
				);
			},
		);

		// Replace variables backed by the environment env store.
		resolvedValue = resolvedValue.replace(
			/\$\{\{environment\.(.*?)\}\}/g,
			(_, ref) => {
				if (environmentVars[ref] !== undefined) {
					return environmentVars[ref];
				}
				throw new Error(`Invalid environment variable: environment.${ref}`);
			},
		);

		const legacyProjectRef = resolvedValue.match(/\$\{\{project\.(.*?)\}\}/);
		if (legacyProjectRef?.[1]) {
			throw new Error(
				`Unsupported workspace environment variable namespace: project.${legacyProjectRef[1]}. Use workspace.${legacyProjectRef[1]} instead.`,
			);
		}

		// Replace bare references against the merged set (self- and cross-layer).
		resolvedValue = resolvedValue.replace(/\$\{\{(.*?)\}\}/g, (_, ref) => {
			if (mergedVars[ref] !== undefined) {
				return mergedVars[ref];
			}
			throw new Error(`Invalid service environment variable: ${ref}`);
		});

		return `${key}=${resolvedValue}`;
	});

	return resolvedVars;
};

export const prepareEnvironmentVariablesForShell = (
	serviceEnv: string | null,
	projectEnv?: string | null,
	environmentEnv?: string | null,
): string[] => {
	const envVars = prepareEnvironmentVariables(
		serviceEnv,
		projectEnv,
		environmentEnv,
	);
	// Using shell-quote library to properly escape shell arguments
	// This is the standard way to handle special characters in shell commands
	return envVars.map((env) => quote([env]));
};

export const parseEnvironmentKeyValuePair = (
	pair: string,
): [string, string] => {
	const [key, ...valueParts] = pair.split("=");
	if (!key || !valueParts.length) {
		throw new Error(`Invalid environment variable pair: ${pair}`);
	}

	return [key, valueParts.join("=")];
};

export const getEnvironmentVariablesObject = (
	input: string | null,
	projectEnv?: string | null,
	environmentEnv?: string | null,
) => {
	const envs = prepareEnvironmentVariables(input, projectEnv, environmentEnv);

	const jsonObject: Record<string, string> = {};

	for (const pair of envs) {
		const [key, value] = parseEnvironmentKeyValuePair(pair);
		if (key && value) {
			jsonObject[key] = value;
		}
	}

	return jsonObject;
};

export const generateVolumeMounts = (mounts: ApplicationNested["mounts"]) => {
	if (!mounts || mounts.length === 0) {
		return [];
	}

	return mounts
		.filter((mount) => mount.type === "volume")
		.map((mount) => ({
			Type: "volume" as const,
			Source: mount.volumeName || "",
			Target: mount.mountPath,
		}));
};

type Resources = {
	memoryLimit: string | null;
	memoryReservation: string | null;
	cpuLimit: string | null;
	cpuReservation: string | null;
};
export const calculateResources = ({
	memoryLimit,
	memoryReservation,
	cpuLimit,
	cpuReservation,
}: Resources): ResourceRequirements => {
	return {
		Limits: {
			MemoryBytes: memoryLimit ? Number.parseInt(memoryLimit, 10) : undefined,
			NanoCPUs: cpuLimit ? Number.parseInt(cpuLimit, 10) : undefined,
		},
		Reservations: {
			MemoryBytes: memoryReservation
				? Number.parseInt(memoryReservation, 10)
				: undefined,
			NanoCPUs: cpuReservation
				? Number.parseInt(cpuReservation, 10)
				: undefined,
		},
	};
};

export const generateConfigContainer = (
	application: Partial<ApplicationNested>,
) => {
	const {
		healthCheckSwarm,
		restartPolicySwarm,
		placementSwarm,
		updateConfigSwarm,
		rollbackConfigSwarm,
		modeSwarm,
		labelsSwarm,
		replicas,
		mounts,
		networkSwarm,
		stopGracePeriodSwarm,
		endpointSpecSwarm,
		ulimitsSwarm,
	} = application;

	const haveMounts = mounts && mounts.length > 0;

	return {
		...(healthCheckSwarm && {
			HealthCheck: healthCheckSwarm,
		}),
		...(restartPolicySwarm && {
			RestartPolicy: restartPolicySwarm,
		}),
		...(placementSwarm
			? {
					Placement: placementSwarm,
				}
			: {
					// if app have mounts keep manager as constraint
					Placement: {
						Constraints: haveMounts ? ["node.role==manager"] : [],
					},
				}),
		...(labelsSwarm && {
			Labels: labelsSwarm,
		}),
		...(modeSwarm
			? {
					Mode: modeSwarm,
				}
			: {
					// use replicas value if no modeSwarm provided
					Mode: {
						Replicated: {
							Replicas: replicas,
						},
					},
				}),
		...(rollbackConfigSwarm
			? { RollbackConfig: rollbackConfigSwarm }
			: {
					// default rollback config to match update config
					RollbackConfig: {
						Parallelism: 1,
						Order: "start-first",
					},
				}),
		...(updateConfigSwarm
			? { UpdateConfig: updateConfigSwarm }
			: {
					// default config if no updateConfigSwarm provided
					UpdateConfig: {
						Parallelism: 1,
						Order: "start-first",
						FailureAction: "rollback",
					},
				}),
		...(stopGracePeriodSwarm !== null &&
			stopGracePeriodSwarm !== undefined && {
				StopGracePeriod: stopGracePeriodSwarm,
			}),
		...(networkSwarm
			? {
					Networks: networkSwarm,
				}
			: {
					Networks: [{ Target: "docklands-network" }],
				}),
		...(endpointSpecSwarm && {
			EndpointSpec: {
				...(endpointSpecSwarm.Mode && { Mode: endpointSpecSwarm.Mode }),
				Ports:
					endpointSpecSwarm.Ports?.map((port) => ({
						Protocol: (port.Protocol || "tcp") as "tcp" | "udp" | "sctp",
						TargetPort: port.TargetPort || 0,
						PublishedPort: port.PublishedPort || 0,
						PublishMode: (port.PublishMode || "host") as "ingress" | "host",
					})) || [],
			},
		}),
		...(ulimitsSwarm &&
			ulimitsSwarm.length > 0 && {
				Ulimits: ulimitsSwarm,
			}),
	};
};

export const generateBindMounts = (mounts: ApplicationNested["mounts"]) => {
	if (!mounts || mounts.length === 0) {
		return [];
	}

	return mounts
		.filter((mount) => mount.type === "bind")
		.map((mount) => ({
			Type: "bind" as const,
			Source: mount.hostPath || "",
			Target: mount.mountPath,
		}));
};

export const generateFileMounts = (
	appName: string,
	service: ApplicationNested | DatabaseNested,
) => {
	const { mounts } = service;
	const { APPLICATIONS_PATH } = paths(!!service.runtimeWorkerId);
	if (!mounts || mounts.length === 0) {
		return [];
	}

	return mounts
		.filter((mount) => mount.type === "file")
		.map((mount) => {
			const fileName = mount.filePath;
			const absoluteBasePath = path.resolve(APPLICATIONS_PATH);
			const directory = path.join(absoluteBasePath, appName, "files");
			const sourcePath = resolveFileMountPath(directory, fileName || "");
			return {
				Type: "bind" as const,
				Source: sourcePath,
				Target: mount.mountPath,
			};
		});
};

const assertFileMountPathInsideBase = (basePath: string, fullPath: string) => {
	const relative = path.relative(basePath, fullPath);
	if (
		relative === "" ||
		relative.startsWith("..") ||
		path.isAbsolute(relative)
	) {
		throw new Error(FILE_MOUNT_PATH_ERROR);
	}
};

export const resolveFileMountPath = (outputPath: string, filePath: string) => {
	if (!isSafeRelativeFileMountPath(filePath)) {
		throw new Error(FILE_MOUNT_PATH_ERROR);
	}

	const basePath = path.resolve(outputPath);
	const fullPath = path.resolve(basePath, filePath);
	assertFileMountPathInsideBase(basePath, fullPath);
	return fullPath;
};

export const createFile = async (
	outputPath: string,
	filePath: string,
	content: string,
) => {
	const fullPath = resolveFileMountPath(outputPath, filePath);
	if (filePath.endsWith("/")) {
		fs.mkdirSync(fullPath, { recursive: true });
		return;
	}

	const directory = path.dirname(fullPath);
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(fullPath, content || "");
};
export const encodeBase64 = (content: string) =>
	Buffer.from(content, "utf-8").toString("base64");

export const getCreateFileCommand = (
	outputPath: string,
	filePath: string,
	content: string,
) => {
	const fullPath = resolveFileMountPath(outputPath, filePath);
	if (filePath.endsWith("/")) {
		return `mkdir -p -- ${quote([fullPath])};`;
	}

	const directory = path.dirname(fullPath);
	const encodedContent = encodeBase64(content);
	return `
		mkdir -p -- ${quote([directory])};
		printf %s ${quote([encodedContent])} | base64 -d > ${quote([fullPath])};
	`;
};

export const getDeleteFileCommand = (outputPath: string, filePath: string) => {
	const fullPath = resolveFileMountPath(outputPath, filePath);
	return `rm -rf -- ${quote([fullPath])};`;
};

export const getServiceContainer = async (
	appName: string,
	runtimeWorkerId?: string | null,
) => {
	const filter = {
		status: ["running"],
		label: [`com.docker.swarm.service.name=${appName}`],
	};
	const remoteDocker = await getRemoteDocker(runtimeWorkerId);
	const containers = await remoteDocker.listContainers({
		filters: JSON.stringify(filter),
	});

	if (containers.length === 0 || !containers[0]) {
		return null;
	}

	return containers[0];
};

export const getComposeContainer = async (
	compose: Compose,
	serviceName: string,
) => {
	const { appName, composeType, runtimeWorkerId } = compose;
	// 1. Determine the correct labels based on composeType
	const labels: string[] = [];
	if (composeType === "stack") {
		// Labels for Docker Swarm stack services
		labels.push(`com.docker.stack.namespace=${appName}`);
		labels.push(`com.docker.swarm.service.name=${appName}_${serviceName}`);
	} else {
		// Labels for Docker Compose workspaces (default)
		labels.push(`com.docker.compose.workspace=${appName}`);
		labels.push(`com.docker.compose.service=${serviceName}`);
	}
	const filter = {
		status: ["running"],
		label: labels,
	};

	const remoteDocker = await getRemoteDocker(runtimeWorkerId);
	const containers = await remoteDocker.listContainers({
		filters: JSON.stringify(filter),
		limit: 1,
	});

	if (containers.length === 0 || !containers[0]) {
		return null;
	}

	return containers[0];
};

type ServiceHealthStatus = {
	status: "healthy" | "unhealthy";
	message?: string;
};

const checkSwarmServiceRunning = async (
	serviceName: string,
): Promise<ServiceHealthStatus> => {
	try {
		const service = docker.getService(serviceName);
		const info = await service.inspect();
		const replicas = info.Spec?.Mode?.Replicated?.Replicas ?? 0;
		if (replicas === 0) {
			return {
				status: "unhealthy",
				message: "Service has 0 replicas configured",
			};
		}

		// Check that at least one task is actually running
		const tasks = await docker.listTasks({
			filters: JSON.stringify({
				service: [serviceName],
				"desired-state": ["running"],
			}),
		});

		const runningTask = tasks.find((t) => t.Status?.State === "running");

		if (!runningTask) {
			const latestTask = tasks[0];
			const taskState = latestTask?.Status?.State ?? "unknown";
			return {
				status: "unhealthy",
				message: `No running tasks (current state: ${taskState})`,
			};
		}

		return { status: "healthy" };
	} catch (error) {
		return {
			status: "unhealthy",
			message: error instanceof Error ? error.message : "Service not found",
		};
	}
};

const getSwarmServiceContainerId = async (
	serviceName: string,
): Promise<string | null> => {
	try {
		const tasks = await docker.listTasks({
			filters: JSON.stringify({
				service: [serviceName],
				"desired-state": ["running"],
			}),
		});

		const runningTask = tasks.find((t) => t.Status?.State === "running");

		return runningTask?.Status?.ContainerStatus?.ContainerID ?? null;
	} catch {
		return null;
	}
};

export const checkPostgresHealth = async (): Promise<ServiceHealthStatus> => {
	const serviceCheck = await checkSwarmServiceRunning("docklands-postgres");
	if (serviceCheck.status === "unhealthy") {
		return serviceCheck;
	}

	// Verify PostgreSQL actually accepts connections
	const containerId = await getSwarmServiceContainerId("docklands-postgres");
	if (!containerId) {
		return { status: "unhealthy", message: "Could not find running container" };
	}

	try {
		const exec = await docker.getContainer(containerId).exec({
			Cmd: ["pg_isready", "-U", "docklands"],
			AttachStdout: true,
			AttachStderr: true,
		});
		const stream = await exec.start({});

		const output = await new Promise<string>((resolve) => {
			let data = "";
			stream.on("data", (chunk: Buffer) => {
				data += chunk.toString();
			});
			stream.on("end", () => resolve(data));
		});

		const inspectResult = await exec.inspect();
		if (inspectResult.ExitCode !== 0) {
			return {
				status: "unhealthy",
				message: `PostgreSQL not ready: ${output.trim()}`,
			};
		}

		return { status: "healthy" };
	} catch (error) {
		return {
			status: "unhealthy",
			message:
				error instanceof Error ? error.message : "Failed to check PostgreSQL",
		};
	}
};

export const checkTraefikHealth = async (): Promise<ServiceHealthStatus> => {
	// Traefik can run as a standalone container or a swarm service
	try {
		const container = docker.getContainer("docklands-traefik");
		const info = await container.inspect();
		if (!info.State.Running) {
			return {
				status: "unhealthy",
				message: "Container is not running",
			};
		}
		return { status: "healthy" };
	} catch {
		// Not a standalone container, check as swarm service
		return checkSwarmServiceRunning("docklands-traefik");
	}
};
