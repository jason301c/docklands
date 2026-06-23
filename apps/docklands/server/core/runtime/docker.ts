import { createLogger } from "@/server/core/lib/logger";
import { execAsync } from "@/server/core/utils/process/execAsync";

const logger = createLogger("docker");

/** Returns if the current operating system is Windows Subsystem for Linux (WSL). */
export const isWSL = async () => {
	try {
		const { stdout } = await execAsync("uname -r");
		const isWSL = stdout.includes("microsoft");
		return isWSL;
	} catch {
		return false;
	}
};

/** Returns the Docker host IP address. */
export const getDockerHost = async (): Promise<string> => {
	if (process.env.NODE_ENV === "production") {
		if (process.platform === "linux" && !(await isWSL())) {
			try {
				// Try to get the Docker bridge IP first
				const { stdout } = await execAsync(
					"ip route | awk '/default/ {print $3}'",
				);

				const hostIp = stdout.trim();
				if (!hostIp) {
					throw new Error("Failed to get Docker host IP");
				}

				return hostIp;
			} catch (error) {
				logger.warn(
					{ err: error },
					"Failed to get Docker host IP, falling back to 172.17.0.1",
				);
				return "172.17.0.1"; // Default Docker bridge network IP
			}
		}

		return "host.docker.internal";
	}

	return "localhost";
};
