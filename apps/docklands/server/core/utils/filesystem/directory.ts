import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";
import type { Application } from "@/server/core/services/application";
import { execAsync, execAsyncRemote } from "../process/execAsync";

const logger = createLogger("fs");

export const recreateDirectory = async (pathFolder: string): Promise<void> => {
	try {
		await removeDirectoryIfExistsContent(pathFolder);
		await fsPromises.mkdir(pathFolder, { recursive: true });
		logger.debug({ path: pathFolder }, "directory recreated");
	} catch (error) {
		logger.error({ err: error, path: pathFolder }, "recreateDirectory failed");
		throw error;
	}
};

export const recreateDirectoryRemote = async (
	pathFolder: string,
	runtimeWorkerId: string | null,
): Promise<void> => {
	try {
		await execAsyncRemote(
			runtimeWorkerId,
			`rm -rf ${pathFolder}; mkdir -p ${pathFolder}`,
		);
		logger.debug(
			{ path: pathFolder, runtimeWorkerId },
			"remote directory recreated",
		);
	} catch (error) {
		logger.error(
			{ err: error, path: pathFolder, runtimeWorkerId },
			"recreateDirectoryRemote failed",
		);
		throw error;
	}
};

export const removeDirectoryIfExistsContent = async (
	path: string,
): Promise<void> => {
	if (fs.existsSync(path) && fs.readdirSync(path).length !== 0) {
		await execAsync(`rm -rf ${path}`);
	}
};

export const removeFileOrDirectory = async (path: string) => {
	try {
		await execAsync(`rm -rf ${path}`);
	} catch (error) {
		logger.error({ err: error, path }, "removeFileOrDirectory failed");
		throw error;
	}
};

export const removeDirectoryCode = async (
	appName: string,
	runtimeWorkerId?: string | null,
) => {
	const { APPLICATIONS_PATH } = paths(!!runtimeWorkerId);
	const directoryPath = path.join(APPLICATIONS_PATH, appName);
	const command = `rm -rf ${directoryPath}`;
	try {
		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	} catch (error) {
		logger.error(
			{ err: error, path: directoryPath, appName, runtimeWorkerId },
			"removeDirectoryCode failed",
		);
		throw error;
	}
};

export const removeComposeDirectory = async (
	appName: string,
	runtimeWorkerId?: string | null,
) => {
	const { COMPOSE_PATH } = paths(!!runtimeWorkerId);
	const directoryPath = path.join(COMPOSE_PATH, appName);
	const command = `rm -rf ${directoryPath}`;
	try {
		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	} catch (error) {
		logger.error(
			{ err: error, path: directoryPath, appName, runtimeWorkerId },
			"removeComposeDirectory failed",
		);
		throw error;
	}
};

export const removeMonitoringDirectory = async (
	appName: string,
	runtimeWorkerId?: string | null,
) => {
	const { MONITORING_PATH } = paths(!!runtimeWorkerId);
	const directoryPath = path.join(MONITORING_PATH, appName);
	const command = `rm -rf ${directoryPath}`;
	try {
		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	} catch (error) {
		logger.error(
			{ err: error, path: directoryPath, appName, runtimeWorkerId },
			"removeMonitoringDirectory failed",
		);
		throw error;
	}
};

export const getBuildAppDirectory = (application: Application) => {
	const runtimeWorkerId =
		application.buildRuntimeWorkerId || application.runtimeWorkerId;
	const { APPLICATIONS_PATH } = paths(!!runtimeWorkerId);
	const { appName, buildType, sourceType, customGitBuildPath, dockerfile } =
		application;
	let buildPath = "";

	if (sourceType === "github") {
		buildPath = application?.buildPath || "";
	} else if (sourceType === "gitlab") {
		buildPath = application?.gitlabBuildPath || "";
	} else if (sourceType === "bitbucket") {
		buildPath = application?.bitbucketBuildPath || "";
	} else if (sourceType === "gitea") {
		buildPath = application?.giteaBuildPath || "";
	} else if (sourceType === "drop") {
		buildPath = application?.dropBuildPath || "";
	} else if (sourceType === "git") {
		buildPath = customGitBuildPath || "";
	}
	if (buildType === "dockerfile") {
		return path.join(
			APPLICATIONS_PATH,
			appName,
			"code",
			buildPath ?? "",
			dockerfile || "Dockerfile",
		);
	}

	return path.join(APPLICATIONS_PATH, appName, "code", buildPath ?? "");
};

export const getDockerContextPath = (application: Application) => {
	const { APPLICATIONS_PATH } = paths(!!application.runtimeWorkerId);
	const { appName, dockerContextPath } = application;

	if (!dockerContextPath) {
		return null;
	}
	return path.join(APPLICATIONS_PATH, appName, "code", dockerContextPath);
};
