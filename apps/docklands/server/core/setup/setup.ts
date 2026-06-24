import os from "node:os";
import { createLogger } from "@/server/core/lib/logger";
import { docker } from "../constants";

const logger = createLogger("setup:swarm-network");

// The address remote worker nodes use to reach this manager. Hardcoding
// loopback meant remote workers could never join (the headline multi-machine
// feature was broken). Honor an explicit override, else pick the first
// non-internal IPv4, else fall back to loopback for single-node/local installs.
const resolveAdvertiseAddr = (): string => {
	if (process.env.SWARM_ADVERTISE_ADDR) {
		return process.env.SWARM_ADVERTISE_ADDR;
	}
	for (const iface of Object.values(os.networkInterfaces())) {
		for (const addr of iface ?? []) {
			if (addr.family === "IPv4" && !addr.internal) {
				return addr.address;
			}
		}
	}
	return "127.0.0.1";
};

export const initializeSwarm = async () => {
	const swarmInitialized = await dockerSwarmInitialized();
	if (swarmInitialized) {
		logger.info("Swarm is already initialized");
	} else {
		const advertiseAddr = resolveAdvertiseAddr();
		await docker.swarmInit({
			AdvertiseAddr: advertiseAddr,
			ListenAddr: "0.0.0.0",
		});
		logger.info({ advertiseAddr }, "Swarm initialized");
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
