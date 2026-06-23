import { createLogger } from "@/server/core/lib/logger";
import { docker } from "../constants";

const logger = createLogger("setup:swarm-network");

export const initializeSwarm = async () => {
	const swarmInitialized = await dockerSwarmInitialized();
	if (swarmInitialized) {
		logger.info("Swarm is already initialized");
	} else {
		await docker.swarmInit({
			AdvertiseAddr: "127.0.0.1",
			ListenAddr: "0.0.0.0",
		});
		logger.info("Swarm initialized");
	}
};

export const dockerSwarmInitialized = async () => {
	try {
		await docker.swarmInspect();

		return true;
	} catch (err) {
		logger.debug({ err }, "Swarm inspect failed — treating as not initialized");
		return false;
	}
};

export const initializeNetwork = async () => {
	const networkInitialized = await dockerNetworkInitialized();
	if (networkInitialized) {
		logger.info("Docker network is already initialized");
	} else {
		try {
			await docker.createNetwork({
				Attachable: true,
				Name: "docklands-network",
				Driver: "overlay",
			});
			logger.info("Docker network created");
		} catch (err) {
			logger.error({ err }, "Failed to create docklands-network");
			throw err;
		}
	}
};

export const dockerNetworkInitialized = async () => {
	try {
		await docker.getNetwork("docklands-network").inspect();
		return true;
	} catch (err) {
		logger.debug(
			{ err },
			"Network inspect failed — treating as not initialized",
		);
		return false;
	}
};
