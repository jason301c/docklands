import * as bcrypt from "bcrypt";
import type { Security } from "@/server/core/services/security";
import type { ApplicationNested } from "../builders";
import {
	loadOrCreateConfig,
	loadOrCreateConfigRemote,
	writeTraefikConfig,
	writeTraefikConfigRemote,
} from "./application";
import type {
	BasicAuthMiddleware,
	FileConfig,
	HttpMiddleware,
} from "./file-types";
import {
	addMiddleware,
	deleteMiddleware,
	loadMiddlewares,
	loadRemoteMiddlewares,
	writeMiddleware,
} from "./middleware";

export const createSecurityMiddleware = async (
	application: ApplicationNested,
	data: Security,
) => {
	const { appName, runtimeWorkerId } = application;
	let config: FileConfig;

	if (runtimeWorkerId) {
		config = await loadRemoteMiddlewares(runtimeWorkerId);
	} else {
		config = loadMiddlewares<FileConfig>();
	}
	const middlewareName = `auth-${appName}`;

	const user = `${data.username}:${await bcrypt.hash(data.password, 10)}`;

	if (config.http?.middlewares) {
		const currentMiddleware = config.http.middlewares[middlewareName];
		if (isBasicAuthMiddleware(currentMiddleware)) {
			currentMiddleware.basicAuth.users = [
				...(currentMiddleware.basicAuth.users || []),
				user,
			];
		} else {
			config.http.middlewares[middlewareName] = {
				basicAuth: {
					removeHeader: true,
					users: [user],
				},
			};
		}
	}
	let appConfig: FileConfig;

	if (runtimeWorkerId) {
		appConfig = await loadOrCreateConfigRemote(runtimeWorkerId, appName);
	} else {
		appConfig = loadOrCreateConfig(appName);
	}
	addMiddleware(appConfig, middlewareName);
	if (runtimeWorkerId) {
		await writeTraefikConfigRemote(config, "middlewares", runtimeWorkerId);
		await writeTraefikConfigRemote(appConfig, appName, runtimeWorkerId);
	} else {
		writeTraefikConfig(appConfig, appName);
		writeMiddleware(config);
	}
};

export const removeSecurityMiddleware = async (
	application: ApplicationNested,
	data: Security,
) => {
	const { appName, runtimeWorkerId } = application;
	let config: FileConfig;

	if (runtimeWorkerId) {
		config = await loadRemoteMiddlewares(runtimeWorkerId);
	} else {
		config = loadMiddlewares<FileConfig>();
	}
	let appConfig: FileConfig;

	if (runtimeWorkerId) {
		appConfig = await loadOrCreateConfigRemote(runtimeWorkerId, appName);
	} else {
		appConfig = loadOrCreateConfig(appName);
	}
	const middlewareName = `auth-${appName}`;

	if (config.http?.middlewares) {
		const currentMiddleware = config.http.middlewares[middlewareName];
		if (isBasicAuthMiddleware(currentMiddleware)) {
			const users = currentMiddleware.basicAuth.users;
			const filteredUsers =
				users?.filter((user) => {
					const [username] = user.split(":");
					return username !== data.username;
				}) || [];
			currentMiddleware.basicAuth.users = filteredUsers;

			if (filteredUsers.length === 0) {
				if (config?.http?.middlewares?.[middlewareName]) {
					delete config.http.middlewares[middlewareName];
				}
				deleteMiddleware(appConfig, middlewareName);
				if (runtimeWorkerId) {
					await writeTraefikConfigRemote(appConfig, appName, runtimeWorkerId);
				} else {
					writeTraefikConfig(appConfig, appName);
				}
			}
		}
	}

	if (runtimeWorkerId) {
		await writeTraefikConfigRemote(config, "middlewares", runtimeWorkerId);
	} else {
		writeMiddleware(config);
	}
};

const isBasicAuthMiddleware = (
	middleware: HttpMiddleware | undefined,
): middleware is { basicAuth: BasicAuthMiddleware } => {
	return !!middleware && "basicAuth" in middleware;
};
