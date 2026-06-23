/**
 * Database engine registry — the single source of truth for Docklands' managed
 * database/cache services.
 *
 * Every per-engine fact that used to be hard-coded across six parallel
 * schema/router/service/builder files lives here as one descriptor per engine:
 * detection signals, deploy specifics (image, port, mount path, env recipe),
 * connection-variable recipes, backup commands, and credential rotation.
 *
 * This module is intentionally free of database, Docker, and filesystem imports
 * so it stays a pure, unit-testable description of engine behavior. The generic
 * `database` table stores the shared columns plus an engine-specific `config`
 * jsonb validated by the engine's `configSchema`; everything engine-specific is
 * derived from these descriptors.
 */
import { z } from "zod";
import { createLogger } from "@/server/core/lib/logger";
import {
	DATABASE_ENGINE_KEYS,
	type DatabaseEngineKey,
	databaseEngineSupportsBackup,
} from "@/shared/database-engines";

const logger = createLogger("db");

export {
	DATABASE_ENGINE_KEYS,
	type DatabaseEngineKey,
	databaseEngineSupportsBackup,
};

export interface EnvEntry {
	key: string;
	value: string;
}

// ---------------------------------------------------------------------------
// Per-engine config schemas (the engine-specific `config` jsonb)
// ---------------------------------------------------------------------------

export const postgresConfigSchema = z.object({
	databaseName: z.string(),
	databaseUser: z.string(),
	databasePassword: z.string(),
});

export const mysqlConfigSchema = z.object({
	databaseName: z.string(),
	databaseUser: z.string(),
	databasePassword: z.string(),
	databaseRootPassword: z.string(),
});

export const mariadbConfigSchema = mysqlConfigSchema;

export const mongoConfigSchema = z.object({
	databaseUser: z.string(),
	databasePassword: z.string(),
	replicaSets: z.boolean().default(false),
});

export const redisConfigSchema = z.object({
	databasePassword: z.string(),
});

export const libsqlConfigSchema = z.object({
	databaseUser: z.string(),
	databasePassword: z.string(),
	sqldNode: z.enum(["primary", "replica"]).default("primary"),
	sqldPrimaryUrl: z.string().optional(),
	enableNamespaces: z.boolean().default(false),
	externalGRPCPort: z.number().int().optional(),
	externalAdminPort: z.number().int().optional(),
});

export type PostgresConfig = z.infer<typeof postgresConfigSchema>;
export type MysqlConfig = z.infer<typeof mysqlConfigSchema>;
export type MariadbConfig = z.infer<typeof mariadbConfigSchema>;
export type MongoConfig = z.infer<typeof mongoConfigSchema>;
export type RedisConfig = z.infer<typeof redisConfigSchema>;
export type LibsqlConfig = z.infer<typeof libsqlConfigSchema>;

export interface DatabaseConfigByKey {
	postgres: PostgresConfig;
	mysql: MysqlConfig;
	mariadb: MariadbConfig;
	mongo: MongoConfig;
	redis: RedisConfig;
	libsql: LibsqlConfig;
}

// ---------------------------------------------------------------------------
// Detection signals (ported from Coolify bootstrap/helpers)
// ---------------------------------------------------------------------------

/**
 * Image base names (registry prefix stripped) that, when used in a standalone
 * fashion, contain a database. Used by the template detection bridge to decide
 * "is this compose service a database we should manage?"
 */

/**
 * Images whose names contain a database keyword but which are applications, not
 * databases. Detection must treat these as apps. Ported from Coolify's
 * `isDatabaseImageWithContext` known-application list.
 */
export const KNOWN_APPLICATION_IMAGE_DENYLIST = [
	"supertokens/supertokens-mysql",
	"supertokens/supertokens-postgresql",
	"supertokens/supertokens-mongodb",
	"registry.supertokens.io/supertokens",
	"metabase/metabase",
	"amancevice/superset",
	"nocodb/nocodb",
	"ghcr.io/umami-software/umami",
	"infisical/infisical",
	"postgrest/postgrest",
	"supabase/postgres-meta",
	"bluewaveuptime/uptime_redis",
] as const;

// ---------------------------------------------------------------------------
// Engine descriptor
// ---------------------------------------------------------------------------

export interface ConnectionVarsArgs<C> {
	appName: string;
	config: C;
}

export interface BackupCommandArgs {
	/** database name / collection target */
	database: string;
	databaseUser: string;
	databasePassword: string;
}

export interface ChangePasswordArgs {
	databaseUser: string;
	databasePassword: string;
	databaseRootPassword?: string;
	/** the user whose password is being changed (defaults to databaseUser) */
	targetUser?: string;
	newPassword: string;
}

export interface PublishedPort {
	targetPort: number;
	publishedPort: number;
}

export interface ContainerCommand {
	Command?: string[];
	Args?: string[];
}

export interface ContainerCommandArgs<C> {
	appName: string;
	config: C;
	command?: string | null;
	args?: string[] | null;
}

export interface DatabaseEngine<
	K extends DatabaseEngineKey = DatabaseEngineKey,
> {
	key: K;
	label: string;
	/** icon/logo key, matching public/templates or component icon maps */
	logo: string;
	tags: string[];

	/** default docker image suggested in the create UI */
	defaultImage: string;
	/** the port the database listens on inside the container */
	containerPort: number;

	// --- detection ---
	/** base image names (registry prefix stripped) that mean this engine */
	imagePatterns: string[];
	/** env keys whose presence strongly signals this engine in a compose file */
	detectEnvKeys: string[];
	/** healthcheck command fragments that signal this engine */
	detectHealthcheck: string[];

	// --- config ---
	configSchema: z.ZodType<DatabaseConfigByKey[K]>;

	// --- deploy specifics ---
	mountPath: (dockerImage: string) => string;
	/**
	 * Build the default environment block (the engine's required env), then
	 * append any user-provided custom env. Mirrors the old `buildX` builders.
	 */
	buildDefaultEnv: (
		config: DatabaseConfigByKey[K],
		customEnv?: string | null,
	) => string;
	/**
	 * Container Command/Args. Defaults (when omitted) to the user's command/args
	 * verbatim; engines override for baked-in launch behavior (redis requirepass,
	 * mongo replica-set init, libSQL sqld wrapper).
	 */
	buildContainerCommand?: (
		args: ContainerCommandArgs<DatabaseConfigByKey[K]>,
	) => ContainerCommand;
	/**
	 * Published (host) ports. Defaults (when omitted) to a single port mapping
	 * `externalPort -> containerPort`; libSQL publishes HTTP/gRPC/admin.
	 */
	publishedPorts?: (args: {
		config: DatabaseConfigByKey[K];
		externalPort?: number | null;
	}) => PublishedPort[];

	// --- capabilities ---
	connectionVars: (
		args: ConnectionVarsArgs<DatabaseConfigByKey[K]>,
	) => EnvEntry[];
	backup?: {
		/** inner command (without container resolution) for a logical backup */
		dumpCommand: (args: BackupCommandArgs) => string;
	};
	changePassword?: (args: ChangePasswordArgs) => string;
}

const encodeUrlPart = (value: string) => encodeURIComponent(value);

const LIBSQL_DEFAULT_COMMAND =
	"sqld --db-path iku.db --http-listen-addr 0.0.0.0:8080 --grpc-listen-addr 0.0.0.0:5001 --admin-listen-addr 0.0.0.0:5000";

const buildMongoStartupScript = (
	appName: string,
	databaseUser: string,
	databasePassword: string,
	command?: string | null,
) => `
#!/bin/bash

mongod --port 27017 --replSet rs0 --bind_ip_all &
MONGOD_PID=$!

# Wait for MongoDB to be ready
while ! mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
	sleep 2
done

# Check if replica set is already initialized
REPLICA_STATUS=$(mongosh --quiet --eval "rs.status().ok || 0")

if [ "$REPLICA_STATUS" != "1" ]; then
	echo "Initializing replica set..."
	mongosh --eval '
	rs.initiate({
		_id: "rs0",
		members: [{ _id: 0, host: "${appName}:27017", priority: 1 }]
	});

    // Wait for the replica set to initialize
	while (!rs.isMaster().ismaster) {
		sleep(1000);
	}

    // Create root user after replica set is initialized and we are primary
	db.getSiblingDB("admin").createUser({
		user: "${databaseUser}",
		pwd: "${databasePassword}",
		roles: ["root"]
	});
	'

else
	echo "Replica set already initialized."
fi


${command ?? "wait $MONGOD_PID"}`;

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

const postgresEngine: DatabaseEngine<"postgres"> = {
	key: "postgres",
	label: "PostgreSQL",
	logo: "postgres",
	tags: ["postgres", "postgresql", "sql", "relational"],
	defaultImage: "postgres:18",
	containerPort: 5432,
	imagePatterns: [
		"postgres",
		"postgis/postgis",
		"pgvector/pgvector",
		"supabase/postgres",
		"elestio/postgres",
		"timescaledb",
		"timescaledb-ha",
		"bitnami/postgresql",
	],
	detectEnvKeys: ["POSTGRES_PASSWORD", "POSTGRES_USER", "POSTGRES_DB"],
	detectHealthcheck: ["pg_isready"],
	configSchema: postgresConfigSchema,
	mountPath: (dockerImage) => {
		const versionMatch = dockerImage.match(/postgres:(\d+)/);
		if (versionMatch?.[1]) {
			const version = Number.parseInt(versionMatch[1], 10);
			// PostgreSQL 18+ uses /var/lib/postgresql/{version}/docker as PGDATA
			if (version >= 18) return `/var/lib/postgresql/${version}/docker`;
		}
		return "/var/lib/postgresql/data";
	},
	buildDefaultEnv: ({ databaseName, databaseUser, databasePassword }, env) =>
		`POSTGRES_DB="${databaseName}"\nPOSTGRES_USER="${databaseUser}"\nPOSTGRES_PASSWORD="${databasePassword}"${
			env ? `\n${env}` : ""
		}`,
	connectionVars: ({ appName, config }) => {
		const user = encodeUrlPart(config.databaseUser);
		const password = encodeUrlPart(config.databasePassword);
		const database = encodeUrlPart(config.databaseName);
		return [
			{
				key: "DATABASE_URL",
				value: `postgresql://${user}:${password}@${appName}:5432/${database}`,
			},
			{ key: "POSTGRES_HOST", value: appName },
			{ key: "POSTGRES_DB", value: config.databaseName },
			{ key: "POSTGRES_USER", value: config.databaseUser },
			{ key: "POSTGRES_PASSWORD", value: config.databasePassword },
		];
	},
	backup: {
		dumpCommand: ({ database, databaseUser }) =>
			`docker exec -i $CONTAINER_ID bash -c "set -o pipefail; pg_dump -Fc --no-acl --no-owner -h localhost -U ${databaseUser} --no-password '${database}' | gzip"`,
	},
	changePassword: ({ databaseUser, newPassword }) =>
		`docker exec "$CONTAINER_ID" psql -U "${databaseUser}" -c "ALTER USER \\"${databaseUser}\\" WITH PASSWORD '${newPassword}';"`,
};

// ---------------------------------------------------------------------------
// MySQL
// ---------------------------------------------------------------------------

const mysqlEngine: DatabaseEngine<"mysql"> = {
	key: "mysql",
	label: "MySQL",
	logo: "mysql",
	tags: ["mysql", "sql", "relational"],
	defaultImage: "mysql:8",
	containerPort: 3306,
	imagePatterns: ["mysql", "mysql/mysql-server", "bitnami/mysql"],
	detectEnvKeys: ["MYSQL_ROOT_PASSWORD", "MYSQL_PASSWORD", "MYSQL_DATABASE"],
	detectHealthcheck: ["mysqladmin ping"],
	configSchema: mysqlConfigSchema,
	mountPath: () => "/var/lib/mysql",
	buildDefaultEnv: (
		{ databaseName, databaseUser, databasePassword, databaseRootPassword },
		env,
	) =>
		databaseUser !== "root"
			? `MYSQL_USER="${databaseUser}"\nMYSQL_DATABASE="${databaseName}"\nMYSQL_PASSWORD="${databasePassword}"\nMYSQL_ROOT_PASSWORD="${databaseRootPassword}"${
					env ? `\n${env}` : ""
				}`
			: `MYSQL_DATABASE="${databaseName}"\nMYSQL_ROOT_PASSWORD="${databaseRootPassword}"${
					env ? `\n${env}` : ""
				}`,
	connectionVars: ({ appName, config }) => {
		const user = encodeUrlPart(config.databaseUser);
		const password = encodeUrlPart(config.databasePassword);
		const database = encodeUrlPart(config.databaseName);
		return [
			{
				key: "DATABASE_URL",
				value: `mysql://${user}:${password}@${appName}:3306/${database}`,
			},
			{ key: "MYSQL_HOST", value: appName },
			{ key: "MYSQL_DATABASE", value: config.databaseName },
			{ key: "MYSQL_USER", value: config.databaseUser },
			{ key: "MYSQL_PASSWORD", value: config.databasePassword },
		];
	},
	backup: {
		// Dumps run as root: callers pass the root password as `databasePassword`,
		// so the user (`root`) and password must stay paired. See the matching
		// `root` user in the mariadb dump command.
		dumpCommand: ({ database, databasePassword }) =>
			`docker exec -i $CONTAINER_ID bash -c "set -o pipefail; mysqldump --default-character-set=utf8mb4 -u 'root' --password='${databasePassword}' --single-transaction --no-tablespaces --quick '${database}' | gzip"`,
	},
	changePassword: ({
		databaseRootPassword,
		targetUser,
		databaseUser,
		newPassword,
	}) =>
		`docker exec "$CONTAINER_ID" mysql -u root -p'${databaseRootPassword}' -e "ALTER USER '${targetUser ?? databaseUser}'@'%' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;"`,
};

// ---------------------------------------------------------------------------
// MariaDB
// ---------------------------------------------------------------------------

const mariadbEngine: DatabaseEngine<"mariadb"> = {
	key: "mariadb",
	label: "MariaDB",
	logo: "mariadb",
	tags: ["mariadb", "mysql", "sql", "relational"],
	defaultImage: "mariadb:11",
	containerPort: 3306,
	imagePatterns: ["mariadb", "bitnami/mariadb"],
	detectEnvKeys: [
		"MARIADB_ROOT_PASSWORD",
		"MARIADB_PASSWORD",
		"MARIADB_DATABASE",
	],
	detectHealthcheck: ["mariadb-admin ping", "healthcheck.sh"],
	configSchema: mariadbConfigSchema,
	mountPath: () => "/var/lib/mysql",
	buildDefaultEnv: (
		{ databaseName, databaseUser, databasePassword, databaseRootPassword },
		env,
	) =>
		`MARIADB_DATABASE="${databaseName}"\nMARIADB_USER="${databaseUser}"\nMARIADB_PASSWORD="${databasePassword}"\nMARIADB_ROOT_PASSWORD="${databaseRootPassword}"${
			env ? `\n${env}` : ""
		}`,
	connectionVars: ({ appName, config }) => {
		const user = encodeUrlPart(config.databaseUser);
		const password = encodeUrlPart(config.databasePassword);
		const database = encodeUrlPart(config.databaseName);
		return [
			{
				key: "DATABASE_URL",
				value: `mariadb://${user}:${password}@${appName}:3306/${database}`,
			},
			{ key: "MARIADB_HOST", value: appName },
			{ key: "MARIADB_DATABASE", value: config.databaseName },
			{ key: "MARIADB_USER", value: config.databaseUser },
			{ key: "MARIADB_PASSWORD", value: config.databasePassword },
		];
	},
	backup: {
		// Dumps run as root for consistency with the mysql engine: callers pass the
		// root password as `databasePassword`, so the dump must authenticate as
		// `root` (not the configured app user) for the user/password pair to match.
		dumpCommand: ({ database, databasePassword }) =>
			`docker exec -i $CONTAINER_ID bash -c "set -o pipefail; mariadb-dump --user='root' --password='${databasePassword}' --single-transaction --quick --databases ${database} | gzip"`,
	},
	changePassword: ({
		databaseRootPassword,
		targetUser,
		databaseUser,
		newPassword,
	}) =>
		`docker exec "$CONTAINER_ID" mariadb -u root -p'${databaseRootPassword}' -e "ALTER USER '${targetUser ?? databaseUser}'@'%' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;"`,
};

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------

const mongoEngine: DatabaseEngine<"mongo"> = {
	key: "mongo",
	label: "MongoDB",
	logo: "mongo",
	tags: ["mongo", "mongodb", "document", "nosql"],
	defaultImage: "mongo:8",
	containerPort: 27017,
	imagePatterns: ["mongo", "bitnami/mongodb"],
	detectEnvKeys: ["MONGO_INITDB_ROOT_PASSWORD", "MONGO_INITDB_ROOT_USERNAME"],
	detectHealthcheck: ["mongosh", "mongo --eval", "db.adminCommand"],
	configSchema: mongoConfigSchema,
	mountPath: () => "/data/db",
	buildDefaultEnv: ({ databaseUser, databasePassword, replicaSets }, env) =>
		`MONGO_INITDB_ROOT_USERNAME="${databaseUser}"\nMONGO_INITDB_ROOT_PASSWORD="${databasePassword}"${
			replicaSets ? "\nMONGO_INITDB_DATABASE=admin" : ""
		}${env ? `\n${env}` : ""}`,
	buildContainerCommand: ({ appName, config, command, args }) => {
		if (config.replicaSets) {
			return {
				Command: ["/bin/bash"],
				Args: [
					"-c",
					buildMongoStartupScript(
						appName,
						config.databaseUser,
						config.databasePassword,
						command,
					),
				],
			};
		}
		return {
			...(command ? { Command: command.split(" ") } : {}),
			...(args && args.length > 0 ? { Args: args } : {}),
		};
	},
	connectionVars: ({ appName, config }) => {
		const user = encodeUrlPart(config.databaseUser);
		const password = encodeUrlPart(config.databasePassword);
		return [
			{
				key: "MONGO_URL",
				value: `mongodb://${user}:${password}@${appName}:27017/?authSource=admin`,
			},
			{ key: "MONGO_HOST", value: appName },
			{ key: "MONGO_USER", value: config.databaseUser },
			{ key: "MONGO_PASSWORD", value: config.databasePassword },
		];
	},
	backup: {
		dumpCommand: ({ database, databaseUser, databasePassword }) =>
			`docker exec -i $CONTAINER_ID bash -c "set -o pipefail; mongodump -d '${database}' -u '${databaseUser}' -p '${databasePassword}' --archive --authenticationDatabase admin --gzip"`,
	},
	changePassword: ({ databaseUser, databasePassword, newPassword }) =>
		`docker exec "$CONTAINER_ID" mongosh -u '${databaseUser}' -p '${databasePassword}' --authenticationDatabase admin --eval "db.getSiblingDB('admin').changeUserPassword('${databaseUser}', '${newPassword}')"`,
};

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

const redisEngine: DatabaseEngine<"redis"> = {
	key: "redis",
	label: "Redis",
	logo: "redis",
	tags: ["redis", "cache", "queue", "key-value", "datastore"],
	defaultImage: "redis:7",
	containerPort: 6379,
	imagePatterns: ["redis", "bitnami/redis", "valkey/valkey"],
	detectEnvKeys: ["REDIS_PASSWORD"],
	detectHealthcheck: ["redis-cli ping"],
	configSchema: redisConfigSchema,
	mountPath: () => "/data",
	buildDefaultEnv: ({ databasePassword }, env) =>
		`REDIS_PASSWORD="${databasePassword}"${env ? `\n${env}` : ""}`,
	buildContainerCommand: ({ config, command, args }) => {
		if (command || (args && args.length > 0)) {
			return {
				...(command ? { Command: command.split(" ") } : {}),
				...(args && args.length > 0 ? { Args: args } : {}),
			};
		}
		return {
			Command: ["/bin/sh"],
			Args: ["-c", `redis-server --requirepass ${config.databasePassword}`],
		};
	},
	connectionVars: ({ appName, config }) => {
		const password = encodeUrlPart(config.databasePassword);
		return [
			{ key: "REDIS_URL", value: `redis://:${password}@${appName}:6379` },
			{ key: "REDIS_HOST", value: appName },
			{ key: "REDIS_PASSWORD", value: config.databasePassword },
		];
	},
	// Redis has no logical dump backup in Docklands (excluded by design).
	changePassword: ({ databasePassword, newPassword }) =>
		`docker exec "$CONTAINER_ID" redis-cli -a '${databasePassword}' config set requirepass '${newPassword}'`,
};

// ---------------------------------------------------------------------------
// libSQL (sqld)
// ---------------------------------------------------------------------------

const libsqlEngine: DatabaseEngine<"libsql"> = {
	key: "libsql",
	label: "libSQL",
	logo: "libsql",
	tags: ["libsql", "sqlite", "turso"],
	defaultImage: "ghcr.io/tursodatabase/libsql-server:v0.24.32",
	containerPort: 8080,
	imagePatterns: ["tursodatabase/libsql-server", "libsql-server"],
	// All SQLD_* env keys are sqld-specific (no other engine uses this prefix),
	// so each is a strong libsql signal: SQLD_NODE/SQLD_PRIMARY_URL drive the
	// primary/replica topology, SQLD_HTTP_AUTH/SQLD_AUTH_JWT_KEY carry auth, and
	// SQLD_USER is read by the credential extractor.
	detectEnvKeys: [
		"SQLD_NODE",
		"SQLD_HTTP_AUTH",
		"SQLD_PRIMARY_URL",
		"SQLD_AUTH_JWT_KEY",
		"SQLD_USER",
	],
	// sqld exposes an HTTP health endpoint on its listen port (default :8080),
	// so libsql healthchecks curl/wget the /health path.
	detectHealthcheck: ["sqld", "/health"],
	configSchema: libsqlConfigSchema,
	mountPath: () => "/var/lib/sqld",
	buildDefaultEnv: (
		{ databaseUser, databasePassword, sqldNode, sqldPrimaryUrl },
		env,
	) => {
		const basicAuth = Buffer.from(
			`${databaseUser}:${databasePassword}`,
			"utf-8",
		).toString("base64");
		return `SQLD_NODE="${sqldNode}"\nSQLD_HTTP_AUTH="basic:${basicAuth}"${
			env ? `\n${env}` : ""
		}${sqldNode === "replica" ? `\nSQLD_PRIMARY_URL="${sqldPrimaryUrl}"` : ""}`;
	},
	buildContainerCommand: ({ config, command }) => {
		let finalCommand = command ?? LIBSQL_DEFAULT_COMMAND;
		if (config.enableNamespaces) finalCommand += " --enable-namespaces";
		return { Command: ["/bin/sh"], Args: ["-c", finalCommand] };
	},
	publishedPorts: ({ config, externalPort }) => {
		const ports: PublishedPort[] = [];
		if (externalPort)
			ports.push({ targetPort: 8080, publishedPort: externalPort });
		if (config.externalGRPCPort)
			ports.push({ targetPort: 5001, publishedPort: config.externalGRPCPort });
		if (config.externalAdminPort)
			ports.push({ targetPort: 5000, publishedPort: config.externalAdminPort });
		return ports;
	},
	connectionVars: ({ appName, config }) => [
		{ key: "LIBSQL_URL", value: `http://${appName}:8080` },
		{ key: "LIBSQL_AUTH_TOKEN", value: config.databasePassword },
	],
	// libSQL backup is a tar of /var/lib/sqld, handled by the volume path; no
	// logical dump command. changePassword is not supported (auth is env-baked).
};

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const databaseEngines: {
	[K in DatabaseEngineKey]: DatabaseEngine<K>;
} = {
	postgres: postgresEngine,
	mysql: mysqlEngine,
	mariadb: mariadbEngine,
	mongo: mongoEngine,
	redis: redisEngine,
	libsql: libsqlEngine,
};

export const isDatabaseEngineKey = (
	value: string,
): value is DatabaseEngineKey =>
	(DATABASE_ENGINE_KEYS as readonly string[]).includes(value);

export const getDatabaseEngine = <K extends DatabaseEngineKey>(
	key: K,
): DatabaseEngine<K> => databaseEngines[key];

/** Validate a raw config blob against an engine's schema, returning the typed config. */
export const parseDatabaseConfig = <K extends DatabaseEngineKey>(
	key: K,
	raw: unknown,
): DatabaseConfigByKey[K] =>
	databaseEngines[key].configSchema.parse(raw) as DatabaseConfigByKey[K];

// ---------------------------------------------------------------------------
// Dispatch helpers — call engine behavior with a runtime key + parsed config.
// These centralize the single cast needed to index the engine record with a
// dynamic key; consumers stay type-safe.
// ---------------------------------------------------------------------------

export const buildDatabaseEnv = <K extends DatabaseEngineKey>(
	key: K,
	config: DatabaseConfigByKey[K],
	customEnv?: string | null,
): string => databaseEngines[key].buildDefaultEnv(config as never, customEnv);

export const databaseConnectionVars = <K extends DatabaseEngineKey>(
	key: K,
	args: ConnectionVarsArgs<DatabaseConfigByKey[K]>,
): EnvEntry[] => databaseEngines[key].connectionVars(args as never);

export const databaseMountPath = (
	key: DatabaseEngineKey,
	dockerImage: string,
): string => databaseEngines[key].mountPath(dockerImage);

export const buildDatabaseContainerCommand = <K extends DatabaseEngineKey>(
	key: K,
	args: ContainerCommandArgs<DatabaseConfigByKey[K]>,
): ContainerCommand => {
	const engine = databaseEngines[key];
	if (engine.buildContainerCommand)
		return engine.buildContainerCommand(args as never);
	const { command, args: cmdArgs } = args;
	return {
		...(command ? { Command: command.split(" ") } : {}),
		...(cmdArgs && cmdArgs.length > 0 ? { Args: cmdArgs } : {}),
	};
};

export const buildDatabasePublishedPorts = <K extends DatabaseEngineKey>(
	key: K,
	args: { config: DatabaseConfigByKey[K]; externalPort?: number | null },
): PublishedPort[] => {
	const engine = databaseEngines[key];
	if (engine.publishedPorts) return engine.publishedPorts(args as never);
	return args.externalPort
		? [{ targetPort: engine.containerPort, publishedPort: args.externalPort }]
		: [];
};

/**
 * Values interpolated into the change-password / dump shell commands must not
 * contain shell-dangerous characters. This mirrors `DATABASE_PASSWORD_REGEX`
 * (duplicated locally so this module stays import-free and unit-testable) and is
 * enforced *here*, at the shell-building boundary, so the commands can never be
 * built from unsafe input even if a caller bypasses the schema validation.
 */
const SHELL_SAFE_DB_VALUE = /^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~]*$/;

export class UnsafeDatabaseShellValueError extends Error {
	constructor(field: string) {
		super(
			`Database ${field} contains characters that are unsafe to interpolate ` +
				"into a shell command.",
		);
		this.name = "UnsafeDatabaseShellValueError";
	}
}

const assertShellSafe = (field: string, value: string | undefined) => {
	if (value !== undefined && !SHELL_SAFE_DB_VALUE.test(value)) {
		logger.error(
			{ field },
			"db: unsafe shell value rejected for engine command",
		);
		throw new UnsafeDatabaseShellValueError(field);
	}
};

export const databaseBackupCommand = <K extends DatabaseEngineKey>(
	key: K,
	args: BackupCommandArgs,
): string | null => {
	assertShellSafe("name", args.database);
	assertShellSafe("user", args.databaseUser);
	assertShellSafe("password", args.databasePassword);
	return databaseEngines[key].backup?.dumpCommand(args) ?? null;
};

export const databaseChangePasswordCommand = <K extends DatabaseEngineKey>(
	key: K,
	args: ChangePasswordArgs,
): string | null => {
	assertShellSafe("user", args.databaseUser);
	assertShellSafe("target user", args.targetUser);
	assertShellSafe("password", args.newPassword);
	assertShellSafe("root password", args.databaseRootPassword);
	return databaseEngines[key].changePassword?.(args) ?? null;
};

/**
 * Thrown when a managed-database engine is detected inside a compose stack but
 * its credentials cannot be determined from the resolved environment. Callers
 * should treat this as "do not promote this service" rather than silently
 * storing a wrong-but-plausible config (which would fail backups and surface
 * incorrect connection info).
 */
export class DatabaseCredentialExtractionError extends Error {
	constructor(
		readonly engine: DatabaseEngineKey,
		readonly missing: string,
	) {
		super(
			`Detected a ${engine} database but could not determine its password ` +
				`from the compose environment (expected ${missing}). The service was ` +
				"not promoted to a managed database — backups and connection variables " +
				"would otherwise use incorrect credentials.",
		);
		this.name = "DatabaseCredentialExtractionError";
	}
}

/**
 * Extract an engine's credentials from a compose service's resolved
 * `environment` map (magic variables already expanded). Used by the template
 * bridge to give a `service_database` its credentials so it can be backed up
 * and surface connection info, without typed columns.
 *
 * Conventional name/user defaults (e.g. user `postgres`, `root`) match the
 * official images and are kept. But for engines that require authentication
 * (postgres/mysql/mariadb) a *missing password* is never a safe default — it
 * produces a config that looks valid but cannot authenticate — so this throws
 * {@link DatabaseCredentialExtractionError}. Engines where an empty password is
 * a legitimate no-auth configuration (redis/mongo/libsql) keep the empty value.
 */
export const extractDatabaseCredentials = <K extends DatabaseEngineKey>(
	key: K,
	env: Record<string, string>,
): DatabaseConfigByKey[K] => {
	const decodeLibsql = () => {
		const auth = env.SQLD_HTTP_AUTH ?? "";
		const basic = auth.startsWith("basic:") ? auth.slice("basic:".length) : "";
		if (basic) {
			try {
				const [user, ...rest] = Buffer.from(basic, "base64")
					.toString("utf-8")
					.split(":");
				return { user: user ?? "", password: rest.join(":") };
			} catch (err) {
				logger.warn(
					{ err },
					"db: malformed SQLD_HTTP_AUTH base64 value — falling back to empty credentials",
				);
			}
		}
		return { user: env.SQLD_USER ?? "libsql", password: "" };
	};

	switch (key) {
		case "postgres": {
			const databasePassword = env.POSTGRES_PASSWORD ?? "";
			if (!databasePassword) {
				throw new DatabaseCredentialExtractionError(
					"postgres",
					"POSTGRES_PASSWORD",
				);
			}
			return {
				databaseName: env.POSTGRES_DB ?? "postgres",
				databaseUser: env.POSTGRES_USER ?? "postgres",
				databasePassword,
			} as DatabaseConfigByKey[K];
		}
		case "mysql": {
			const databasePassword =
				env.MYSQL_PASSWORD ?? env.MYSQL_ROOT_PASSWORD ?? "";
			if (!databasePassword) {
				throw new DatabaseCredentialExtractionError(
					"mysql",
					"MYSQL_PASSWORD or MYSQL_ROOT_PASSWORD",
				);
			}
			return {
				databaseName: env.MYSQL_DATABASE ?? "mysql",
				databaseUser: env.MYSQL_USER ?? "root",
				databasePassword,
				databaseRootPassword: env.MYSQL_ROOT_PASSWORD ?? "",
			} as DatabaseConfigByKey[K];
		}
		case "mariadb": {
			const databasePassword =
				env.MARIADB_PASSWORD ??
				env.MYSQL_PASSWORD ??
				env.MARIADB_ROOT_PASSWORD ??
				env.MYSQL_ROOT_PASSWORD ??
				"";
			if (!databasePassword) {
				throw new DatabaseCredentialExtractionError(
					"mariadb",
					"MARIADB_PASSWORD or MARIADB_ROOT_PASSWORD",
				);
			}
			return {
				databaseName: env.MARIADB_DATABASE ?? env.MYSQL_DATABASE ?? "mariadb",
				databaseUser: env.MARIADB_USER ?? env.MYSQL_USER ?? "root",
				databasePassword,
				databaseRootPassword:
					env.MARIADB_ROOT_PASSWORD ?? env.MYSQL_ROOT_PASSWORD ?? "",
			} as DatabaseConfigByKey[K];
		}
		case "mongo":
			return {
				databaseUser: env.MONGO_INITDB_ROOT_USERNAME ?? "mongo",
				databasePassword: env.MONGO_INITDB_ROOT_PASSWORD ?? "",
				replicaSets: false,
			} as DatabaseConfigByKey[K];
		case "redis":
			return {
				databasePassword: env.REDIS_PASSWORD ?? "",
			} as DatabaseConfigByKey[K];
		default: {
			const { user, password } = decodeLibsql();
			return {
				databaseUser: user,
				databasePassword: password,
				sqldNode: "primary",
				enableNamespaces: false,
			} as DatabaseConfigByKey[K];
		}
	}
};
