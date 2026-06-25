import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dbUrl } from "@/server/core/db";
import { createLogger } from "@/server/core/lib/logger";
import { runPreMigrationBackup } from "./pre-migration-backup";

const logger = createLogger("ops:migrate-db");

const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql);

try {
	await runPreMigrationBackup(sql, dbUrl);
	await migrate(db, { migrationsFolder: "drizzle" });
	logger.info("Migration complete");
} catch (error) {
	logger.fatal({ err: error }, "Migration failed");
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 1 });
}
