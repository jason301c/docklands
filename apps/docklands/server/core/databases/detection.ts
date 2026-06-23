/**
 * Database detection — decides whether a compose service is a managed database,
 * and which engine. Ported from Coolify's `isDatabaseImage` /
 * `isDatabaseImageWithContext` (bootstrap/helpers/docker.php), backed by the
 * engine registry rather than a loose image constant.
 *
 * Used by the template bridge: when a compose stack is instantiated, each
 * service whose image is detected as a database is promoted to a
 * `service_database` so it inherits backups and connection variables.
 */
import {
	databaseEngines,
	DATABASE_ENGINE_KEYS,
	type DatabaseEngineKey,
	KNOWN_APPLICATION_IMAGE_DENYLIST,
} from "./registry";

/** Standard database ports — a strong signal a container is a database. */
const DATABASE_PORTS = [
	"3306",
	"5432",
	"27017",
	"6379",
	"8086",
	"9200",
	"7687",
	"8123",
];

/** App-specific env/healthcheck signals that argue *against* "this is a database". */
const APPLICATION_ENV_SIGNALS = ["SERVICE_FQDN", "API_KEYS", "APP_", "APPLICATION_"];

export interface ComposeServiceConfig {
	image?: string;
	ports?: unknown;
	environment?: unknown;
	healthcheck?: { test?: unknown } | unknown;
}

/** Strip the tag and registry prefix from an image, returning the base name. */
const baseImageName = (image: string): string => {
	const withoutTag = image.includes(":") ? image.slice(0, image.indexOf(":")) : image;
	return withoutTag.includes("/")
		? withoutTag.slice(withoutTag.lastIndexOf("/") + 1)
		: withoutTag;
};

/** Match a normalized base image name against an engine's imagePatterns. */
const engineForBaseName = (base: string): DatabaseEngineKey | null => {
	for (const key of DATABASE_ENGINE_KEYS) {
		for (const pattern of databaseEngines[key].imagePatterns) {
			const patternBase = pattern.includes("/")
				? pattern.slice(pattern.lastIndexOf("/") + 1)
				: pattern;
			if (base === patternBase) return key;
		}
	}
	return null;
};

const toStringArray = (value: unknown): string[] => {
	if (Array.isArray(value)) return value.map((v) => String(v));
	if (value && typeof value === "object")
		return Object.entries(value as Record<string, unknown>).map(
			([k, v]) => `${k}=${v}`,
		);
	if (typeof value === "string") return [value];
	return [];
};

const healthcheckString = (config: ComposeServiceConfig): string => {
	const test = (config.healthcheck as { test?: unknown } | undefined)?.test;
	if (Array.isArray(test)) return test.map((v) => String(v)).join(" ");
	if (typeof test === "string") return test;
	return "";
};

/**
 * Given an image known to be a database base name, use the surrounding compose
 * service config to confirm or reject. Returns true if it really is a database.
 */
const confirmDatabaseWithContext = (
	imageName: string,
	config: ComposeServiceConfig,
	engineKey: DatabaseEngineKey,
): boolean => {
	// Known applications that merely embed a database keyword in their name.
	for (const denied of KNOWN_APPLICATION_IMAGE_DENYLIST) {
		if (imageName.includes(denied)) return false;
	}

	const ports = toStringArray(config.ports);
	const hasStandardDbPort = ports.some((p) =>
		DATABASE_PORTS.some((dbPort) => p.includes(dbPort)),
	);

	const env = toStringArray(config.environment).map((e) => e.toUpperCase());
	const engine = databaseEngines[engineKey];
	const hasDbEnvVars = env.some((e) =>
		engine.detectEnvKeys.some((key) => e.includes(key.toUpperCase())),
	);
	const hasAppEnvVars = env.some((e) =>
		APPLICATION_ENV_SIGNALS.some((sig) => e.includes(sig)),
	);

	const health = healthcheckString(config).toLowerCase();
	const hasDbHealthcheck = engine.detectHealthcheck.some((h) =>
		health.includes(h.toLowerCase()),
	);

	// Strong positive signals win; a clear app signal with no db signal loses.
	if (hasDbEnvVars || hasDbHealthcheck || hasStandardDbPort) return true;
	if (hasAppEnvVars) return false;
	// Name matched a known database image and nothing argued against it.
	return true;
};

/**
 * Detect which managed database engine an image represents, or null if it is
 * not a database. When `config` is provided, contextual disambiguation runs to
 * avoid false positives (e.g. postgrest, metabase, supertokens-postgresql).
 */
export const detectDatabaseEngine = (
	image: string | null | undefined,
	config?: ComposeServiceConfig,
): DatabaseEngineKey | null => {
	if (!image) return null;
	const imageName = image.includes(":") ? image.slice(0, image.indexOf(":")) : image;
	const engineKey = engineForBaseName(baseImageName(image));
	if (!engineKey) return null;
	if (config && !confirmDatabaseWithContext(imageName, config, engineKey))
		return null;
	return engineKey;
};

/** Boolean convenience wrapper mirroring Coolify's `isDatabaseImage`. */
export const isDatabaseImage = (
	image: string | null | undefined,
	config?: ComposeServiceConfig,
): boolean => detectDatabaseEngine(image, config) !== null;
