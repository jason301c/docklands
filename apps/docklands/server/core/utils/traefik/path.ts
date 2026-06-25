import path from "node:path";
import { paths } from "@/server/core/constants/paths";

export const TRAEFIK_CONFIG_PATH_ERROR =
	"Invalid path: Traefik config path must be an absolute path under the Traefik config directory and cannot contain traversal, control characters, or shell metacharacters";

const SAFE_TRAEFIK_CONFIG_PATH = /^\/[A-Za-z0-9._/-]+$/;

const isInsideOrEqual = (root: string, candidate: string) =>
	candidate === root || candidate.startsWith(`${root}${path.sep}`);

export const normalizeTraefikConfigPath = (
	inputPath: string,
	runtimeWorkerId?: string | null,
) => {
	if (!inputPath || inputPath !== inputPath.trim()) {
		throw new Error(TRAEFIK_CONFIG_PATH_ERROR);
	}

	if (!inputPath.startsWith("/") || !SAFE_TRAEFIK_CONFIG_PATH.test(inputPath)) {
		throw new Error(TRAEFIK_CONFIG_PATH_ERROR);
	}

	const segments = inputPath.split("/");
	if (segments.some((segment) => segment === "." || segment === "..")) {
		throw new Error(TRAEFIK_CONFIG_PATH_ERROR);
	}

	const normalized = path.normalize(inputPath);
	if (normalized !== inputPath) {
		throw new Error(TRAEFIK_CONFIG_PATH_ERROR);
	}

	const { MAIN_TRAEFIK_PATH } = paths(!!runtimeWorkerId);
	const root = path.resolve(MAIN_TRAEFIK_PATH);
	const resolved = path.resolve(normalized);
	if (!isInsideOrEqual(root, resolved)) {
		throw new Error(TRAEFIK_CONFIG_PATH_ERROR);
	}

	return resolved;
};
