import fs from "node:fs";
import Docker from "dockerode";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("docker");

export const DOCKLANDS_DOCKER_API_VERSION =
	process.env.DOCKLANDS_DOCKER_API_VERSION;
export const DOCKLANDS_DOCKER_HOST = process.env.DOCKLANDS_DOCKER_HOST;
export const DOCKLANDS_DOCKER_PORT = process.env.DOCKLANDS_DOCKER_PORT
	? Number(process.env.DOCKLANDS_DOCKER_PORT)
	: undefined;

type DockerSocketCandidate = {
	label: string;
	path: string;
};

const getDockerConfig = (): Docker => {
	const versionOption = DOCKLANDS_DOCKER_API_VERSION
		? { version: DOCKLANDS_DOCKER_API_VERSION }
		: {};

	if (DOCKLANDS_DOCKER_HOST) {
		logger.info(
			{ host: DOCKLANDS_DOCKER_HOST, port: DOCKLANDS_DOCKER_PORT },
			"Using remote Docker host",
		);
		return new Docker({
			host: DOCKLANDS_DOCKER_HOST,
			...(DOCKLANDS_DOCKER_PORT && { port: DOCKLANDS_DOCKER_PORT }),
			...versionOption,
		});
	}

	const dockerSocketCandidates: Array<DockerSocketCandidate> = [];

	if (process.env.DOCKER_HOST) {
		dockerSocketCandidates.push({
			label: "DOCKER_HOST environment variable",
			path: process.env.DOCKER_HOST.replace("unix://", ""),
		});
	}

	if (process.env.HOME) {
		dockerSocketCandidates.push({
			label: "Rancher Desktop socket",
			path: `${process.env.HOME}/.rd/docker.sock`,
		});
	}

	dockerSocketCandidates.push({
		label: "Standard Docker socket",
		path: "/var/run/docker.sock",
	});

	for (const candidate of dockerSocketCandidates) {
		try {
			if (candidate.path && fs.existsSync(candidate.path)) {
				logger.info(
					{ label: candidate.label, socketPath: candidate.path },
					"Using Docker socket",
				);
				return new Docker({
					socketPath: candidate.path,
					...versionOption,
				});
			}
		} catch (e) {
			logger.warn(
				{
					label: candidate.label,
					socketPath: candidate.path,
					err: e instanceof Error ? e.message : e,
				},
				"Docker socket candidate failed",
			);
		}
	}

	logger.info({}, "Using default Docker configuration");
	return new Docker({ ...versionOption });
};

export const docker = getDockerConfig();
