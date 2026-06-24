/**
 * Pure, cross-runtime facts about Docklands' managed database engines.
 *
 * The full engine registry (`server/core/databases/registry.ts`) is a heavy
 * backend module. The handful of facts the browser needs — the engine key list,
 * the key union type, and whether an engine supports a logical (dump-based)
 * backup — are extracted here so client forms can import them without reaching
 * into `server/core`. The registry re-exports these so there is still a single
 * source of truth.
 *
 * Keep this file free of DB/Docker/filesystem/zod imports.
 */

export const DATABASE_ENGINE_KEYS = [
	"postgres",
	"mysql",
	"mariadb",
	"mongo",
	"redis",
	"libsql",
] as const;

export type DatabaseEngineKey = (typeof DATABASE_ENGINE_KEYS)[number];

/**
 * Engines that support a logical (dump-based) backup. Redis and libSQL do not
 * (Redis is excluded by design; libSQL is backed up as a volume tar, not a
 * logical dump). Mirrors the `backup` descriptor presence in the engine
 * registry.
 */
const ENGINES_WITH_BACKUP: ReadonlySet<DatabaseEngineKey> = new Set([
	"postgres",
	"mysql",
	"mariadb",
	"mongo",
]);

/** Engines that support a logical (dump-based) backup. Redis/libSQL do not. */
export const databaseEngineSupportsBackup = (key: DatabaseEngineKey): boolean =>
	ENGINES_WITH_BACKUP.has(key);

/** A backup-capable engine — the engines that can appear in the backup forms. */
export type BackupDatabaseEngineKey =
	| "postgres"
	| "mysql"
	| "mariadb"
	| "mongo";

/** Engine keys (in registry order) that support a logical dump backup. */
export const BACKUP_DATABASE_ENGINE_KEYS = DATABASE_ENGINE_KEYS.filter(
	(key): key is BackupDatabaseEngineKey => databaseEngineSupportsBackup(key),
);

/**
 * One credential input a compose-backup needs for an engine. The compose-backup
 * forms collect these into `metadata[engine]` so the dump/restore command can
 * authenticate (a standalone managed database already knows its own credentials,
 * so this only applies to compose backups). The set per engine mirrors what each
 * engine's dump command in the registry actually consumes:
 *  - postgres dumps as its configured user → needs `databaseUser`;
 *  - mysql dumps as root → needs `databaseRootPassword`;
 *  - mariadb/mongo dump with an explicit user+password pair.
 *
 * Form-specific cosmetics (input placeholder text) live in the forms; the
 * structural facts (which fields, their labels, password-ness, and the
 * validation message) live here so the two forms cannot drift.
 */
export interface ComposeBackupMetadataField {
	/** sub-key under `metadata[engine]` and the form field path segment */
	name: "databaseUser" | "databasePassword" | "databaseRootPassword";
	/** FormLabel text */
	label: string;
	/** whether the input renders as `type="password"` */
	isPassword: boolean;
	/** zod superRefine message when the field is empty for a compose backup */
	requiredMessage: string;
}

/**
 * Per-engine credential fields a compose backup/restore collects. Derived from
 * (and kept consistent with) the engine registry's dump commands; the standalone
 * managed-database path needs none of these because it reads stored credentials.
 */
export const COMPOSE_BACKUP_METADATA_FIELDS: Record<
	BackupDatabaseEngineKey,
	readonly ComposeBackupMetadataField[]
> = {
	postgres: [
		{
			name: "databaseUser",
			label: "Database User",
			isPassword: false,
			requiredMessage: "Database user is required for PostgreSQL",
		},
	],
	mysql: [
		{
			name: "databaseRootPassword",
			label: "Root Password",
			isPassword: true,
			requiredMessage: "Root password is required for MySQL",
		},
	],
	mariadb: [
		{
			name: "databaseUser",
			label: "Database User",
			isPassword: false,
			requiredMessage: "Database user is required for MariaDB",
		},
		{
			name: "databasePassword",
			label: "Database Password",
			isPassword: true,
			requiredMessage: "Database password is required for MariaDB",
		},
	],
	mongo: [
		{
			name: "databaseUser",
			label: "Database User",
			isPassword: false,
			requiredMessage: "Database user is required for MongoDB",
		},
		{
			name: "databasePassword",
			label: "Database Password",
			isPassword: true,
			requiredMessage: "Database password is required for MongoDB",
		},
	],
};
