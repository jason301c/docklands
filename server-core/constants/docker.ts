import fs from "node:fs";
import Docker from "dockerode";

export const DOKPLOY_DOCKER_API_VERSION =
	process.env.DOKPLOY_DOCKER_API_VERSION;
export const DOKPLOY_DOCKER_HOST = process.env.DOKPLOY_DOCKER_HOST;
export const DOKPLOY_DOCKER_PORT = process.env.DOKPLOY_DOCKER_PORT
	? Number(process.env.DOKPLOY_DOCKER_PORT)
	: undefined;

type DockerSocketCandidate = {
	label: string;
	path: string;
};

const getDockerConfig = (): Docker => {
	const versionOption = DOKPLOY_DOCKER_API_VERSION
		? { version: DOKPLOY_DOCKER_API_VERSION }
		: {};

	if (DOKPLOY_DOCKER_HOST) {
		console.info(
			`Using remote Docker host: ${DOKPLOY_DOCKER_HOST}${DOKPLOY_DOCKER_PORT ? `:${DOKPLOY_DOCKER_PORT}` : ""}`,
		);
		return new Docker({
			host: DOKPLOY_DOCKER_HOST,
			...(DOKPLOY_DOCKER_PORT && { port: DOKPLOY_DOCKER_PORT }),
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
				console.info(
					`Using Docker socket (${candidate.label}): ${candidate.path}`,
				);
				return new Docker({
					socketPath: candidate.path,
					...versionOption,
				});
			}
		} catch (e) {
			console.info(
				`Docker socket initialization failed for ${candidate.label} (${candidate.path}): ${e instanceof Error ? e.message : "Unknown error"}`,
			);
		}
	}

	console.info(
		"Using default Docker configuration. You can set the DOCKER_HOST environment variable to specify a custom Docker socket path.",
	);
	return new Docker({ ...versionOption });
};

export const docker = getDockerConfig();
