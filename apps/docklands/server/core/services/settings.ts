import { readdirSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import semver from "semver";
import { createLogger } from "@/server/core/lib/logger";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import type { IUpdateData } from "@/shared/runtime-update-types";
import { siteConfig } from "@/shared/site";
import { db } from "../db";
import { compose } from "../db/schema";
import {
	initializeStandaloneTraefik,
	initializeTraefikService,
	type TraefikOptions,
} from "../setup/traefik-setup";

const logger = createLogger("settings");

const DOCKLANDS_IMAGE = process.env.DOCKLANDS_IMAGE || siteConfig.dockerImage;
const DOCKLANDS_DOCKER_HUB_TAGS_URL =
	process.env.DOCKLANDS_DOCKER_HUB_TAGS_URL || siteConfig.dockerHubTagsUrl;

export const DEFAULT_UPDATE_DATA: IUpdateData = {
	latestVersion: null,
	updateAvailable: false,
};

interface DockerHubTag {
	digest: string;
	name: string;
}

interface StableImageTag {
	name: string;
	version: string;
}

const getPlainSemverImageVersion = (tagName: string) => {
	const version = semver.valid(tagName);
	if (!version || version !== tagName) {
		return null;
	}

	return version;
};

export const resolveLatestStableImageTag = (
	tags: DockerHubTag[],
): StableImageTag | null => {
	const latestTag = tags.find((tag) => tag.name === "latest");

	if (!latestTag) {
		return null;
	}

	const candidates = tags
		.filter((tag) => tag.digest === latestTag.digest)
		.map((tag) => ({
			name: tag.name,
			version: getPlainSemverImageVersion(tag.name),
		}))
		.filter(
			(
				tag,
			): tag is {
				name: string;
				version: string;
			} => tag.version !== null,
		);

	return (
		candidates.sort((a, b) => semver.rcompare(a.version, b.version))[0] ?? null
	);
};

/** Returns current Docklands docker image tag or `latest` by default. */
export const getDocklandsImageTag = () => {
	return process.env.RELEASE_TAG || "latest";
};

/** Returns Docklands docker service image digest */
export const getServiceImageDigest = async () => {
	const { stdout } = await execAsync(
		"docker service inspect docklands --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'",
	);

	const currentDigest = stdout.trim().split("@")[1];

	if (!currentDigest) {
		throw new Error("Could not get current service image digest");
	}

	return currentDigest;
};

/** Returns latest version number and information whether runtimeWorker update is available by comparing current image's digest against digest for provided image tag via Docker hub API. */
export const getUpdateData = async (
	currentVersion: string,
): Promise<IUpdateData> => {
	try {
		let url: string | null = `${DOCKLANDS_DOCKER_HUB_TAGS_URL}?page_size=100`;
		let allResults: DockerHubTag[] = [];

		// Fetch all tags from Docker Hub
		while (url) {
			const response = await fetch(url, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			});

			// Docker Hub returns an error body without a `results` array on 404
			// (unpublished repo), rate limiting, etc. Stop rather than
			// concatenating `undefined` into the tag list, which would later
			// throw in resolveLatestStableImageTag.
			if (!response.ok) {
				break;
			}

			const data = (await response.json()) as {
				next: string | null;
				results: DockerHubTag[];
			};

			if (!Array.isArray(data?.results)) {
				break;
			}

			allResults = allResults.concat(data.results);
			url = data.next ?? null;
		}

		const currentImageTag = getDocklandsImageTag();

		// Special handling for canary and feature branches
		// For development versions (canary/feature), don't perform update checks
		// These are unstable versions that change frequently, and users on these
		// branches are expected to manually manage updates
		if (currentImageTag === "canary" || currentImageTag === "feature") {
			const currentDigest = await getServiceImageDigest();
			const latestDigest = allResults.find(
				(t) => t.name === currentImageTag,
			)?.digest;
			if (!latestDigest) {
				return DEFAULT_UPDATE_DATA;
			}
			if (currentDigest !== latestDigest) {
				return {
					latestVersion: currentImageTag,
					updateAvailable: true,
				};
			}
			return {
				latestVersion: currentImageTag,
				updateAvailable: false,
			};
		}

		// For stable versions, use plain semver image tags. Production Docker
		// scripts publish "<version>" and "latest" for the same image digest.
		const latestVersionTag = resolveLatestStableImageTag(allResults);

		if (!latestVersionTag) {
			return DEFAULT_UPDATE_DATA;
		}

		const latestVersion = latestVersionTag.name;

		// Use semver to compare versions for stable releases
		const cleanedCurrent = semver.clean(currentVersion);

		if (!cleanedCurrent) {
			return DEFAULT_UPDATE_DATA;
		}

		// Check if the latest version is greater than the current version
		const updateAvailable = semver.gt(latestVersionTag.version, cleanedCurrent);

		return {
			latestVersion,
			updateAvailable,
		};
	} catch (error) {
		logger.warn({ err: error }, "Error fetching update data from Docker Hub");
		return DEFAULT_UPDATE_DATA;
	}
};

interface TreeDataItem {
	id: string;
	name: string;
	type: "file" | "directory";
	children?: TreeDataItem[];
}

export const readDirectory = async (
	dirPath: string,
	runtimeWorkerId?: string,
): Promise<TreeDataItem[]> => {
	if (runtimeWorkerId) {
		const { stdout } = await execAsyncRemote(
			runtimeWorkerId,
			`
process_items() {
    local parent_dir="$1"
    local __resultvar=$2

    local items_json=""
    local first=true
    for item in "$parent_dir"/*; do
        [ -e "$item" ] || continue
        process_item "$item" item_json
        if [ "$first" = true ]; then
            first=false
            items_json="$item_json"
        else
            items_json="$items_json,$item_json"
        fi
    done

    eval $__resultvar="'[$items_json]'"
}

process_item() {
    local item_path="$1"
    local __resultvar=$2

    local item_name=$(basename "$item_path")
    local escaped_name=$(echo "$item_name" | sed 's/"/\\"/g')
    local escaped_path=$(echo "$item_path" | sed 's/"/\\"/g')

    if [ -d "$item_path" ]; then
        # Is directory
        process_items "$item_path" children_json
        local json='{"id":"'"$escaped_path"'","name":"'"$escaped_name"'","type":"directory","children":'"$children_json"'}'
    else
        # Is file
        local json='{"id":"'"$escaped_path"'","name":"'"$escaped_name"'","type":"file"}'
    fi

    eval $__resultvar="'$json'"
}

root_dir=${dirPath}

process_items "$root_dir" json_output

echo "$json_output"
			`,
		);
		const result = JSON.parse(stdout);
		return result;
	}

	const stack = [dirPath];
	const result: TreeDataItem[] = [];
	const parentMap: Record<string, TreeDataItem[]> = {};

	while (stack.length > 0) {
		const currentPath = stack.pop();
		if (!currentPath) continue;

		const items = readdirSync(currentPath, { withFileTypes: true });
		const currentDirectoryResult: TreeDataItem[] = [];

		for (const item of items) {
			const fullPath = join(currentPath, item.name);
			if (item.isDirectory()) {
				stack.push(fullPath);
				const directoryItem: TreeDataItem = {
					id: fullPath,
					name: item.name,
					type: "directory",
					children: [],
				};
				currentDirectoryResult.push(directoryItem);
				parentMap[fullPath] = directoryItem.children as TreeDataItem[];
			} else {
				const fileItem: TreeDataItem = {
					id: fullPath,
					name: item.name,
					type: "file",
				};
				currentDirectoryResult.push(fileItem);
			}
		}

		if (parentMap[currentPath]) {
			parentMap[currentPath].push(...currentDirectoryResult);
		} else {
			result.push(...currentDirectoryResult);
		}
	}
	return result;
};

export const getDockerResourceType = async (
	resourceName: string,
	runtimeWorkerId?: string,
) => {
	try {
		let result = "";
		const command = `
RESOURCE_NAME="${resourceName}"
if docker service inspect "$RESOURCE_NAME" >/dev/null 2>&1; then
	echo "service"
elif docker inspect "$RESOURCE_NAME" >/dev/null 2>&1; then
	echo "standalone"
else
	echo "unknown"
fi`;

		if (runtimeWorkerId) {
			const { stdout } = await execAsyncRemote(runtimeWorkerId, command);
			result = stdout.trim();
		} else {
			const { stdout } = await execAsync(command);
			result = stdout.trim();
		}
		if (result === "service") {
			return "service";
		}
		if (result === "standalone") {
			return "standalone";
		}
		return "unknown";
	} catch (error) {
		logger.warn(
			{ err: error, resourceName, runtimeWorkerId },
			"getDockerResourceType failed",
		);
		return "unknown";
	}
};

export const reloadDockerResource = async (
	resourceName: string,
	runtimeWorkerId?: string,
	version?: string,
) => {
	const resourceType = await getDockerResourceType(
		resourceName,
		runtimeWorkerId,
	);
	let command = "";
	if (resourceType === "service") {
		if (resourceName === "docklands") {
			const currentImageTag = getDocklandsImageTag();
			let imageTag = version;
			if (currentImageTag === "canary" || currentImageTag === "feature") {
				imageTag = currentImageTag;
			}

			command = `docker service update --force --image ${DOCKLANDS_IMAGE}:${imageTag} ${resourceName}`;
		} else {
			command = `docker service update --force ${resourceName}`;
		}
	} else if (resourceType === "standalone") {
		// Self-update of a standalone `docker run` control plane: `docker restart`
		// keeps the OLD image, so it would silently NOT update. The container also
		// can't safely recreate itself (it would have to kill itself mid-update and
		// reconstruct its own run args). Pull the new image so it's staged, then
		// surface clear guidance that an operator must recreate the container —
		// rather than reporting a successful "update" that changed nothing.
		if (resourceName === "docklands") {
			const currentImageTag = getDocklandsImageTag();
			let imageTag = version;
			if (currentImageTag === "canary" || currentImageTag === "feature") {
				imageTag = currentImageTag;
			}
			const pull = `docker pull ${DOCKLANDS_IMAGE}:${imageTag}`;
			if (runtimeWorkerId) {
				await execAsyncRemote(runtimeWorkerId, pull);
			} else {
				await execAsync(pull);
			}
			throw new Error(
				`Pulled ${DOCKLANDS_IMAGE}:${imageTag}. This is a standalone (docker run) ` +
					"install, which can't update itself in place — recreate the container to " +
					"finish: re-run your install command, or `docker rm -f docklands` then your " +
					"original `docker run …`. (A swarm-service install updates in place.)",
			);
		}
		// Non-self resources: a restart is the intended reload.
		command = `docker restart ${resourceName}`;
	} else {
		throw new Error("Resource type not found");
	}
	if (runtimeWorkerId) {
		await execAsyncRemote(runtimeWorkerId, command);
	} else {
		await execAsync(command);
	}
};

export const readEnvironmentVariables = async (
	resourceName: string,
	runtimeWorkerId?: string,
) => {
	const resourceType = await getDockerResourceType(
		resourceName,
		runtimeWorkerId,
	);
	let command = "";
	if (resourceType === "service") {
		command = `docker service inspect ${resourceName} --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'`;
	} else if (resourceType === "standalone") {
		command = `docker container inspect ${resourceName} --format '{{json .Config.Env}}'`;
	}
	let result = "";
	if (runtimeWorkerId) {
		const { stdout } = await execAsyncRemote(runtimeWorkerId, command);
		result = stdout.trim();
	} else {
		const { stdout } = await execAsync(command);
		result = stdout.trim();
	}
	if (result === "null") {
		return "";
	}
	return JSON.parse(result)?.join("\n");
};

export const readPorts = async (
	resourceName: string,
	runtimeWorkerId?: string,
): Promise<
	{ targetPort: number; publishedPort: number; protocol?: string }[]
> => {
	const resourceType = await getDockerResourceType(
		resourceName,
		runtimeWorkerId,
	);
	let command = "";
	if (resourceType === "service") {
		command = `docker service inspect ${resourceName} --format '{{json .Spec.EndpointSpec.Ports}}'`;
	} else if (resourceType === "standalone") {
		command = `docker container inspect ${resourceName} --format '{{json .NetworkSettings.Ports}}'`;
	} else {
		throw new Error("Resource type not found");
	}
	let result = "";
	if (runtimeWorkerId) {
		const { stdout } = await execAsyncRemote(runtimeWorkerId, command);
		result = stdout.trim();
	} else {
		const { stdout } = await execAsync(command);
		result = stdout.trim();
	}

	if (result === "null") {
		return [];
	}

	const parsedResult = JSON.parse(result);

	if (resourceType === "service") {
		return parsedResult
			.map((port: any) => ({
				targetPort: port.TargetPort,
				publishedPort: port.PublishedPort,
				protocol: port.Protocol,
			}))
			.filter((port: any) => port.targetPort !== 80 && port.targetPort !== 443);
	}
	const ports: {
		targetPort: number;
		publishedPort: number;
		protocol?: string;
	}[] = [];
	const seenPorts = new Set<string>();
	for (const key in parsedResult) {
		if (Object.hasOwn(parsedResult, key)) {
			const containerPortMappings = parsedResult[key];
			const protocol = key.split("/")[1];
			const targetPort = Number.parseInt(key.split("/")[0] ?? "0", 10);

			// Take only the first mapping to avoid duplicates (IPv4 and IPv6)
			const firstMapping = containerPortMappings[0];
			if (firstMapping) {
				const publishedPort = Number.parseInt(firstMapping.HostPort, 10);
				const portKey = `${targetPort}-${publishedPort}-${protocol}`;
				if (!seenPorts.has(portKey)) {
					seenPorts.add(portKey);
					ports.push({
						targetPort: targetPort,
						publishedPort: publishedPort,
						protocol: protocol,
					});
				}
			}
		}
	}
	return ports.filter(
		(port: any) => port.targetPort !== 80 && port.targetPort !== 443,
	);
};

export const checkPortInUse = async (
	port: number,
	runtimeWorkerId?: string,
): Promise<{ isInUse: boolean; conflictingContainer?: string }> => {
	try {
		// Check if port is in use by a Docker container
		const dockerCommand = `docker ps -a --format '{{.Names}}' | grep -v '^docklands-traefik$' | while read name; do docker port "$name" 2>/dev/null | grep -q ':${port}' && echo "$name" && break; done || true`;
		const { stdout: dockerOut } = runtimeWorkerId
			? await execAsyncRemote(runtimeWorkerId, dockerCommand)
			: await execAsync(dockerCommand);

		const container = dockerOut.trim();

		if (container) {
			return {
				isInUse: true,
				conflictingContainer: `container "${container}"`,
			};
		}

		// Check if port is in use by a host-level service (non-Docker)
		// Docklands runs inside a container, so we spawn an ephemeral container
		// with --net=host to share the host's network stack and use nc -z to
		// check if something is listening on the port
		const hostCommand = `docker run --rm --net=host busybox sh -c 'nc -z 0.0.0.0 ${port} 2>/dev/null && echo in_use || echo free'`;
		const { stdout: hostOut } = runtimeWorkerId
			? await execAsyncRemote(runtimeWorkerId, hostCommand)
			: await execAsync(hostCommand);

		if (hostOut.includes("in_use")) {
			return {
				isInUse: true,
				conflictingContainer: "a host-level service",
			};
		}

		return { isInUse: false };
	} catch (error) {
		logger.warn(
			{ err: error, port, runtimeWorkerId },
			"checkPortInUse failed, defaulting to not-in-use",
		);
		return { isInUse: false };
	}
};

export const writeTraefikSetup = async (input: TraefikOptions) => {
	const resourceType = await getDockerResourceType(
		"docklands-traefik",
		input.runtimeWorkerId,
	);

	if (resourceType === "service") {
		await initializeTraefikService({
			env: input.env,
			additionalPorts: input.additionalPorts,
			runtimeWorkerId: input.runtimeWorkerId,
		});
		await reconnectServicesToTraefik(input.runtimeWorkerId);
	} else if (resourceType === "standalone") {
		await initializeStandaloneTraefik({
			env: input.env,
			additionalPorts: input.additionalPorts,
			runtimeWorkerId: input.runtimeWorkerId,
		});

		await reconnectServicesToTraefik(input.runtimeWorkerId);
	} else {
		throw new Error("Traefik resource type not found");
	}
};

export const reconnectServicesToTraefik = async (runtimeWorkerId?: string) => {
	const composeResult = await db.query.compose.findMany({
		where: and(
			...(runtimeWorkerId
				? [eq(compose.runtimeWorkerId, runtimeWorkerId)]
				: []),
			eq(compose.isolatedDeployment, true),
		),
	});

	if (!composeResult) {
		return;
	}
	let commands = "";

	for (const compose of composeResult) {
		commands += `docker network connect ${compose.appName} $(docker ps --filter "name=docklands-traefik" -q) >/dev/null 2>&1\n`;
	}

	if (runtimeWorkerId) {
		await execAsyncRemote(runtimeWorkerId, commands);
	} else {
		await execAsync(commands);
	}
};
