import * as fs from "node:fs/promises";
import { execAsync, execAsyncRemote, sleep } from "../utils/process/execAsync";

interface GPUInfo {
	driverInstalled: boolean;
	driverVersion?: string;
	gpuModel?: string;
	runtimeInstalled: boolean;
	runtimeConfigured: boolean;
	cudaSupport: boolean;
	cudaVersion?: string;
	memoryInfo?: string;
	availableGPUs: number;
	swarmEnabled: boolean;
	gpuResources: number;
}

export async function checkGPUStatus(
	runtimeWorkerId?: string,
): Promise<GPUInfo> {
	try {
		const [driverInfo, runtimeInfo, swarmInfo, gpuInfo, cudaInfo] =
			await Promise.all([
				checkGpuDriver(runtimeWorkerId),
				checkRuntime(runtimeWorkerId),
				checkSwarmResources(runtimeWorkerId),
				checkGpuInfo(runtimeWorkerId),
				checkCudaSupport(runtimeWorkerId),
			]);

		return {
			...driverInfo,
			...runtimeInfo,
			...swarmInfo,
			...gpuInfo,
			...cudaInfo,
		};
	} catch {
		return {
			driverInstalled: false,
			driverVersion: undefined,
			runtimeInstalled: false,
			runtimeConfigured: false,
			cudaSupport: false,
			cudaVersion: undefined,
			gpuModel: undefined,
			memoryInfo: undefined,
			availableGPUs: 0,
			swarmEnabled: false,
			gpuResources: 0,
		};
	}
}

const checkGpuDriver = async (runtimeWorkerId?: string) => {
	let driverVersion: string | undefined;
	let driverInstalled = false;
	let availableGPUs = 0;

	try {
		const driverCommand =
			"nvidia-smi --query-gpu=driver_version --format=csv,noheader";
		const { stdout: nvidiaSmi } = runtimeWorkerId
			? await execAsyncRemote(runtimeWorkerId, driverCommand)
			: await execAsync(driverCommand);

		driverVersion = nvidiaSmi.trim();
		if (driverVersion) {
			driverInstalled = true;
			const countCommand =
				"nvidia-smi --query-gpu=gpu_name --format=csv,noheader | wc -l";
			const { stdout: gpuCount } = runtimeWorkerId
				? await execAsyncRemote(runtimeWorkerId, countCommand)
				: await execAsync(countCommand);

			availableGPUs = Number.parseInt(gpuCount.trim(), 10);
		}
	} catch (error) {
		console.debug("GPU driver check:", error);
	}

	return { driverVersion, driverInstalled, availableGPUs };
};

const checkRuntime = async (runtimeWorkerId?: string) => {
	let runtimeInstalled = false;
	let runtimeConfigured = false;

	try {
		// First check: Is nvidia-container-runtime installed?
		const checkBinaryCommand = "command -v nvidia-container-runtime";
		try {
			const { stdout } = runtimeWorkerId
				? await execAsyncRemote(runtimeWorkerId, checkBinaryCommand)
				: await execAsync(checkBinaryCommand);
			runtimeInstalled = !!stdout.trim();
		} catch (error) {
			console.debug("Runtime binary check:", error);
		}

		// Second check: Is it configured in Docker?
		try {
			const runtimeCommand = 'docker info --format "{{json .Runtimes}}"';
			const { stdout: runtimeInfo } = runtimeWorkerId
				? await execAsyncRemote(runtimeWorkerId, runtimeCommand)
				: await execAsync(runtimeCommand);

			const defaultCommand = 'docker info --format "{{.DefaultRuntime}}"';
			const { stdout: defaultRuntime } = runtimeWorkerId
				? await execAsyncRemote(runtimeWorkerId, defaultCommand)
				: await execAsync(defaultCommand);

			const runtimes = JSON.parse(runtimeInfo);
			const hasNvidiaRuntime = "nvidia" in runtimes;
			const isDefaultRuntime = defaultRuntime.trim() === "nvidia";

			// Only set runtimeConfigured if both conditions are met
			runtimeConfigured = hasNvidiaRuntime && isDefaultRuntime;
		} catch (error) {
			console.debug("Runtime configuration check:", error);
		}
	} catch (error) {
		console.debug("Runtime check:", error);
	}

	return { runtimeInstalled, runtimeConfigured };
};

const checkSwarmResources = async (runtimeWorkerId?: string) => {
	let swarmEnabled = false;
	let gpuResources = 0;

	try {
		const nodeCommand =
			"docker node inspect self --format '{{json .Description.Resources.GenericResources}}'";
		const { stdout: resources } = runtimeWorkerId
			? await execAsyncRemote(runtimeWorkerId, nodeCommand)
			: await execAsync(nodeCommand);

		if (resources && resources !== "null") {
			const genericResources = JSON.parse(resources);
			for (const resource of genericResources) {
				if (
					resource.DiscreteResourceSpec &&
					(resource.DiscreteResourceSpec.Kind === "GPU" ||
						resource.DiscreteResourceSpec.Kind === "gpu")
				) {
					gpuResources = resource.DiscreteResourceSpec.Value;
					swarmEnabled = true;
					break;
				}
			}
		}
	} catch (error) {
		console.debug("Swarm resource check:", error);
	}

	return { swarmEnabled, gpuResources };
};

const checkGpuInfo = async (runtimeWorkerId?: string) => {
	let gpuModel: string | undefined;
	let memoryInfo: string | undefined;

	try {
		const gpuInfoCommand =
			"nvidia-smi --query-gpu=gpu_name,memory.total --format=csv,noheader";
		const { stdout: gpuInfo } = runtimeWorkerId
			? await execAsyncRemote(runtimeWorkerId, gpuInfoCommand)
			: await execAsync(gpuInfoCommand);

		[gpuModel, memoryInfo] = gpuInfo.split(",").map((s) => s.trim());
	} catch (error) {
		console.debug("GPU info check:", error);
	}

	return { gpuModel, memoryInfo };
};

const checkCudaSupport = async (runtimeWorkerId?: string) => {
	let cudaVersion: string | undefined;
	let cudaSupport = false;

	try {
		const cudaCommand = 'nvidia-smi -q | grep "CUDA Version"';
		const { stdout: cudaInfo } = runtimeWorkerId
			? await execAsyncRemote(runtimeWorkerId, cudaCommand)
			: await execAsync(cudaCommand);

		const cudaMatch = cudaInfo.match(/CUDA Version\s*:\s*([\d.]+)/);
		cudaVersion = cudaMatch ? cudaMatch[1] : undefined;
		cudaSupport = !!cudaVersion;
	} catch (error) {
		console.debug("CUDA support check:", error);
	}

	return { cudaVersion, cudaSupport };
};

export async function setupGPUSupport(runtimeWorkerId?: string): Promise<void> {
	try {
		// 1. Initial status check and validation
		const initialStatus = await checkGPUStatus(runtimeWorkerId);
		const shouldContinue = await validatePrerequisites(initialStatus);
		if (!shouldContinue) return;

		// 2. Get node ID
		const nodeId = await getNodeId(runtimeWorkerId);

		// 3. Create daemon configuration
		const daemonConfig = createDaemonConfig(initialStatus.availableGPUs);

		// 4. Setup runtimeWorker based on environment
		if (runtimeWorkerId) {
			await setupRemoteServer(runtimeWorkerId, daemonConfig);
		} else {
			await setupLocalServer(daemonConfig);
		}

		// 5. Wait for Docker restart
		await sleep(10000);

		// 6. Add GPU label
		await addGpuLabel(nodeId, runtimeWorkerId);

		// 7. Final verification
		await sleep(5000);
		await verifySetup(nodeId, runtimeWorkerId);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("password is required")
		) {
			throw new Error(
				"Sudo access required. Please run with appropriate permissions.",
			);
		}
		throw error;
	}
}

const validatePrerequisites = async (initialStatus: GPUInfo) => {
	if (!initialStatus.driverInstalled) {
		throw new Error(
			"NVIDIA drivers not installed. Please install appropriate NVIDIA drivers first.",
		);
	}

	if (!initialStatus.runtimeInstalled) {
		throw new Error(
			"NVIDIA Container Runtime not installed. Please install nvidia-container-runtime first.",
		);
	}

	if (initialStatus.swarmEnabled && initialStatus.runtimeConfigured) {
		return false;
	}

	return true;
};

const getNodeId = async (runtimeWorkerId?: string) => {
	const nodeIdCommand = 'docker info --format "{{.Swarm.NodeID}}"';
	const { stdout: nodeId } = runtimeWorkerId
		? await execAsyncRemote(runtimeWorkerId, nodeIdCommand)
		: await execAsync(nodeIdCommand);

	const trimmedNodeId = nodeId.trim();
	if (!trimmedNodeId) {
		throw new Error("Setup Server before enabling GPU support");
	}

	return trimmedNodeId;
};

const createDaemonConfig = (availableGPUs: number) => ({
	runtimes: {
		nvidia: {
			path: "nvidia-container-runtime",
			runtimeArgs: [],
		},
	},
	"default-runtime": "nvidia",
	"node-generic-resources": [`GPU=${availableGPUs}`],
});

const setupRemoteServer = async (
	runtimeWorkerId: string,
	daemonConfig: any,
) => {
	const setupCommands = [
		"sudo -n true",
		`echo '${JSON.stringify(daemonConfig, null, 2)}' | sudo tee /etc/docker/daemon.json`,
		"sudo mkdir -p /etc/nvidia-container-runtime",
		'sudo sed -i "/swarm-resource/d" /etc/nvidia-container-runtime/config.toml',
		'echo "swarm-resource = \\"DOCKER_RESOURCE_GPU\\"" | sudo tee -a /etc/nvidia-container-runtime/config.toml',
		"sudo systemctl daemon-reload",
		"sudo systemctl restart docker",
	].join(" && ");

	await execAsyncRemote(runtimeWorkerId, setupCommands);
};

const setupLocalServer = async (daemonConfig: any) => {
	const configFile = `/tmp/docker-daemon-${Date.now()}.json`;
	await fs.writeFile(configFile, JSON.stringify(daemonConfig, null, 2));

	const setupCommands = [
		`sudo sh -c '
			cp ${configFile} /etc/docker/daemon.json && 
			mkdir -p /etc/nvidia-container-runtime && 
			sed -i "/swarm-resource/d" /etc/nvidia-container-runtime/config.toml &&
			echo "swarm-resource = \\"DOCKER_RESOURCE_GPU\\"" >> /etc/nvidia-container-runtime/config.toml && 
			systemctl daemon-reload && 
			systemctl restart docker
		'`,
		`rm ${configFile}`,
	].join(" && ");

	try {
		await execAsync(setupCommands);
	} catch {
		throw new Error(
			"Failed to configure GPU support. Please ensure you have sudo privileges and try again.",
		);
	}
};

const addGpuLabel = async (nodeId: string, runtimeWorkerId?: string) => {
	const labelCommand = `docker node update --label-add gpu=true ${nodeId}`;
	if (runtimeWorkerId) {
		await execAsyncRemote(runtimeWorkerId, labelCommand);
	} else {
		await execAsync(labelCommand);
	}
};

const verifySetup = async (nodeId: string, runtimeWorkerId?: string) => {
	const finalStatus = await checkGPUStatus(runtimeWorkerId);

	if (!finalStatus.swarmEnabled) {
		const diagnosticCommands = [
			`docker node inspect ${nodeId}`,
			'nvidia-smi -a | grep "GPU UUID"',
			"cat /etc/docker/daemon.json",
			"cat /etc/nvidia-container-runtime/config.toml",
		].join(" && ");

		await (runtimeWorkerId
			? execAsyncRemote(runtimeWorkerId, diagnosticCommands)
			: execAsync(diagnosticCommands));

		throw new Error("GPU support not detected in swarm after setup");
	}

	return finalStatus;
};
