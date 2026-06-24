import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Sql } from "postgres";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";

const execFileAsync = promisify(execFile);
const logger = createLogger("ops:pre-migration-backup");

const MIGRATIONS_FOLDER = "drizzle";

/**
 * Number of migrations recorded in the journal vs. already applied. drizzle's
 * postgres-js migrator records applied migrations in `drizzle.__drizzle_migrations`;
 * a missing table means a brand-new database (nothing applied yet).
 */
const countMigrations = async (
	sql: Sql,
): Promise<{ total: number; applied: number }> => {
	let total = 0;
	try {
		const journal = JSON.parse(
			readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
		) as { entries?: unknown[] };
		total = journal.entries?.length ?? 0;
	} catch {
		total = 0;
	}

	let applied = 0;
	try {
		const rows = await sql<{ c: number }[]>`
			SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations
		`;
		applied = rows[0]?.c ?? 0;
	} catch {
		// Table doesn't exist yet → fresh database, nothing applied.
		applied = 0;
	}

	return { total, applied };
};

/**
 * Dump the database before applying migrations, so a destructive migration can
 * be rolled back. Runs only when an EXISTING database (some migrations already
 * applied) has pending migrations — a fresh database has no data worth dumping,
 * and an up-to-date one needs no backup.
 *
 * Best-effort: on any failure it logs and returns so the upgrade still proceeds.
 * This can never be worse than the previous behavior (no pre-migration backup at
 * all); when it works it adds a safety net. Operators who want a hard guarantee
 * should confirm the dump exists, or take their own backup. Set
 * `SKIP_PRE_MIGRATION_BACKUP=true` to skip entirely (e.g. when the external
 * database is backed up elsewhere). `DATABASE_URL` is never logged.
 */
export const runPreMigrationBackup = async (
	sql: Sql,
	databaseUrl: string,
): Promise<void> => {
	if (process.env.SKIP_PRE_MIGRATION_BACKUP === "true") {
		logger.info(
			"SKIP_PRE_MIGRATION_BACKUP set — skipping pre-migration backup",
		);
		return;
	}

	const { total, applied } = await countMigrations(sql);
	if (applied === 0) {
		logger.info("Fresh database — no pre-migration backup needed");
		return;
	}
	if (total <= applied) {
		logger.info("No pending migrations — skipping pre-migration backup");
		return;
	}

	const pending = total - applied;
	const dir = join(paths().BASE_PATH, "backups", "pre-migration");
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const outFile = join(dir, `docklands-pre-migration-${stamp}.dump`);

	try {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		logger.info(
			{ pending, outFile },
			"Pending migrations detected — taking a pre-migration database backup",
		);
		// Custom format (-Fc) so it restores with pg_restore. pg_dump reads the
		// connection from the URL argument; never logged.
		await execFileAsync("pg_dump", ["-Fc", "-f", outFile, databaseUrl]);
		logger.info({ outFile }, "Pre-migration backup written");
	} catch (err) {
		logger.error(
			{ err },
			"Pre-migration backup failed — proceeding with migration anyway. " +
				"Take a manual backup if you need a rollback point, or set " +
				"SKIP_PRE_MIGRATION_BACKUP=true to silence this.",
		);
	}
};
