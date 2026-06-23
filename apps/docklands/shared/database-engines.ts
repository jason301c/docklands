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
