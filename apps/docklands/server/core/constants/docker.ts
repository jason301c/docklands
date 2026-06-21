import fs from "node:fs";
import Docker from "dockerode";

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
		console.info(
			`Using remote Docker host: ${DOCKLANDS_DOCKER_HOST}${DOCKLANDS_DOCKER_PORT ? `:${DOCKLANDS_DOCKER_PORT}` : ""}`,
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
