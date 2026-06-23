import fs, { createReadStream, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { parse, stringify } from "yaml";
import { paths } from "@/server/core/constants/paths";
import type { Domain } from "@/server/core/services/domain";
import { encodeBase64 } from "../docker/utils";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import type { FileConfig, HttpLoadBalancerService } from "./file-types";

export const createTraefikConfig = (appName: string) => {
	const defaultPort = 3000;
	const serviceURLDefault = `http://${appName}:${defaultPort}`;
	const domainDefault = `Host(\`${appName}.docker.localhost\`)`;
	const config: FileConfig = {
		http: {
			routers: {
				...(process.env.NODE_ENV === "production"
					? {}
					: {
							[`${appName}-router-1`]: {
								rule: domainDefault,
								service: `${appName}-service-1`,
								entryPoints: ["web"],
							},
						}),
			},

			services: {
				...(process.env.NODE_ENV === "production"
					? {}
					: {
							[`${appName}-service-1`]: {
								loadBalancer: {
									servers: [{ url: serviceURLDefault }],
									passHostHeader: true,
								},
							},
						}),
			},
		},
	};
	const yamlStr = stringify(config);
	const { DYNAMIC_TRAEFIK_PATH } = paths();
	fs.mkdirSync(DYNAMIC_TRAEFIK_PATH, { recursive: true });
	writeFileSync(
		path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`),
		yamlStr,
		"utf8",
	);
};

export const removeTraefikConfig = async (
	appName: string,
	runtimeWorkerId?: string | null,
) => {
	try {
		const { DYNAMIC_TRAEFIK_PATH } = paths(!!runtimeWorkerId);
		const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
		const command = `rm -f ${configPath}`;

		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	} catch (error) {
		console.error(`Error removing traefik config for ${appName}:`, error);
	}
};

export const removeTraefikConfigRemote = async (
	appName: string,
	runtimeWorkerId: string,
) => {
	try {
		const { DYNAMIC_TRAEFIK_PATH } = paths(true);
		const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
		await execAsyncRemote(runtimeWorkerId, `rm -f ${configPath}`);
	} catch (error) {
		console.error(
			`Error removing remote traefik config for ${appName}:`,
			error,
		);
	}
};

export const loadOrCreateConfig = (appName: string): FileConfig => {
	const { DYNAMIC_TRAEFIK_PATH } = paths();
	const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
	if (fs.existsSync(configPath)) {
		const yamlStr = fs.readFileSync(configPath, "utf8");
		const parsedConfig = (parse(yamlStr) as FileConfig) || {
			http: { routers: {}, services: {} },
		};
		return parsedConfig;
	}
	return { http: { routers: {}, services: {} } };
};

export const loadOrCreateConfigRemote = async (
	runtimeWorkerId: string,
	appName: string,
) => {
	const { DYNAMIC_TRAEFIK_PATH } = paths(true);
	const fileConfig: FileConfig = { http: { routers: {}, services: {} } };
	const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
	try {
		const { stdout } = await execAsyncRemote(
			runtimeWorkerId,
			`cat ${configPath}`,
		);

		if (!stdout) return fileConfig;

		const parsedConfig = (parse(stdout) as FileConfig) || {
			http: { routers: {}, services: {} },
		};
		return parsedConfig;
	} catch {
		return fileConfig;
	}
};

export const readConfig = (appName: string) => {
	const { DYNAMIC_TRAEFIK_PATH } = paths();
	const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
	if (fs.existsSync(configPath)) {
		const yamlStr = fs.readFileSync(configPath, "utf8");
		return yamlStr;
	}
	return null;
};

export const readRemoteConfig = async (
	runtimeWorkerId: string,
	appName: string,
) => {
	const { DYNAMIC_TRAEFIK_PATH } = paths(true);
	const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
	try {
		const { stdout } = await execAsyncRemote(
			runtimeWorkerId,
			`cat ${configPath}`,
		);
		if (!stdout) return null;
		return stdout;
	} catch {
		return null;
	}
};

export const readMonitoringConfig = async (readAll = false) => {
	const { DYNAMIC_TRAEFIK_PATH } = paths();
	const configPath = path.join(DYNAMIC_TRAEFIK_PATH, "access.log");
	if (fs.existsSync(configPath)) {
		if (!readAll) {
			// Read first 500 lines using streams
			let content = "";
			let validCount = 0;

			const fileStream = createReadStream(configPath, { encoding: "utf8" });
			const readline = createInterface({
				input: fileStream,
				crlfDelay: Number.POSITIVE_INFINITY,
			});

			for await (const line of readline) {
				try {
					const trimmed = line.trim();
					if (
						trimmed !== "" &&
						trimmed.startsWith("{") &&
						trimmed.endsWith("}")
					) {
						const log = JSON.parse(trimmed);
						// Exclude Docklands service app and Dashboard requests
						if (log.ServiceName !== "docklands-service-app@file") {
							content += `${line}\n`;
							validCount++;
							if (validCount >= 500) {
								break;
							}
						}
					}
				} catch {
					// Ignore invalid JSON
				}
			}
			return content;
		}
		return fs.readFileSync(configPath, "utf8");
	}
	return null;
};

export const readConfigInPath = async (
	pathFile: string,
	runtimeWorkerId?: string,
) => {
	const configPath = path.join(pathFile);

	if (runtimeWorkerId) {
		const { stdout } = await execAsyncRemote(
			runtimeWorkerId,
			`cat ${configPath}`,
		);
		if (!stdout) return null;
		return stdout;
	}
	if (fs.existsSync(configPath)) {
		const yamlStr = fs.readFileSync(configPath, "utf8");
		return yamlStr;
	}
	return null;
};

export const writeConfig = (appName: string, traefikConfig: string) => {
	try {
		const { DYNAMIC_TRAEFIK_PATH } = paths();
		const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
		fs.writeFileSync(configPath, traefikConfig, "utf8");
	} catch (e) {
		console.error("Error saving the YAML config file:", e);
	}
};

export const writeConfigRemote = async (
	runtimeWorkerId: string,
	appName: string,
	traefikConfig: string,
) => {
	try {
		const { DYNAMIC_TRAEFIK_PATH } = paths(true);
		const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
		const encoded = encodeBase64(traefikConfig);
		await execAsyncRemote(
			runtimeWorkerId,
			`echo "${encoded}" | base64 -d > "${configPath}"`,
		);
	} catch (e) {
		console.error("Error saving the YAML config file:", e);
	}
};

export const writeTraefikConfigInPath = async (
	pathFile: string,
	traefikConfig: string,
	runtimeWorkerId?: string,
) => {
	try {
		const configPath = path.join(pathFile);
		if (runtimeWorkerId) {
			const encoded = encodeBase64(traefikConfig);
			await execAsyncRemote(
				runtimeWorkerId,
				`echo "${encoded}" | base64 -d > "${configPath}"`,
			);
		} else {
			fs.writeFileSync(configPath, traefikConfig, "utf8");
		}
	} catch (e) {
		console.error("Error saving the YAML config file:", e);
	}
};

export const writeTraefikConfig = (
	traefikConfig: FileConfig,
	appName: string,
) => {
	try {
		const { DYNAMIC_TRAEFIK_PATH } = paths();
		const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
		const yamlStr = stringify(traefikConfig);
		fs.writeFileSync(configPath, yamlStr, "utf8");
	} catch (e) {
		console.error("Error saving the YAML config file:", e);
	}
};

export const writeTraefikConfigRemote = async (
	traefikConfig: FileConfig,
	appName: string,
	runtimeWorkerId: string,
) => {
	try {
		const { DYNAMIC_TRAEFIK_PATH } = paths(true);
		const configPath = path.join(DYNAMIC_TRAEFIK_PATH, `${appName}.yml`);
		// base64-encode the YAML so it can't break out of the shell command (a
		// single quote in the config used to corrupt it / allow injection over
		// SSH). Same pattern as the cert/config writers above.
		const encoded = encodeBase64(stringify(traefikConfig));
		await execAsyncRemote(
			runtimeWorkerId,
			`echo "${encoded}" | base64 -d > "${configPath}"`,
		);
	} catch (e) {
		console.error("Error saving the YAML config file:", e);
	}
};

export const createServiceConfig = (
	appName: string,
	domain: Domain,
): {
	loadBalancer: HttpLoadBalancerService;
} => ({
	loadBalancer: {
		servers: [{ url: `http://${appName}:${domain.port || 80}` }],
		passHostHeader: true,
	},
});
