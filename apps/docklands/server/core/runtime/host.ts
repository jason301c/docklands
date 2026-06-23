import os from "node:os";
import path from "node:path";
import { publicIpv4, publicIpv6 } from "public-ip";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("host");

export const getShell = () => {
	switch (os.platform()) {
		case "win32":
			return "powershell.exe";
		case "darwin":
			return "zsh";
		default:
			return "bash";
	}
};

export const getPublicIpWithFallback = async () => {
	let ip: string | null = null;
	try {
		ip = await publicIpv4();
	} catch (error) {
		logger.warn({ err: error }, "Failed to get public IPv4, trying IPv6");
		try {
			ip = await publicIpv6();
		} catch (error) {
			logger.error({ err: error }, "Failed to get public IPv6 address");
			ip = null;
		}
	}
	if (ip === null) {
		logger.warn({}, "Could not obtain any public IP");
	}
	return ip;
};

export const getLocalServerIp = async () => {
	try {
		const { execAsync } = await import("@/server/core/utils/process/execAsync");
		const command = `ip addr show | grep -E "inet (192.168.|10.|172.1[6-9].|172.2[0-9].|172.3[0-1].)" | head -n1 | awk '{print $2}' | cut -d/ -f1`;
		const { stdout } = await execAsync(command);
		const ip = stdout.trim();
		return (
			ip ||
			"We were unable to obtain the local runtimeWorker IP, please use your private IP address"
		);
	} catch (error) {
		logger.error({ err: error }, "Failed to get local runtime worker IP");
		return "We were unable to obtain the local runtimeWorker IP, please use your private IP address";
	}
};

export const readValidDirectory = (
	directory: string,
	runtimeWorkerId?: string | null,
) => {
	if (!/^[\w/. :[\]-]{1,500}$/.test(directory)) {
		return false;
	}

	const { BASE_PATH } = paths(!!runtimeWorkerId);

	const resolvedBase = path.resolve(BASE_PATH);
	const resolvedDir = path.resolve(directory);

	return (
		resolvedDir === resolvedBase ||
		resolvedDir.startsWith(resolvedBase + path.sep)
	);
};
