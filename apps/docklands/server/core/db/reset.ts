import { sql } from "drizzle-orm";

// Credits to Louistiti from Drizzle Discord: https://discord.com/channels/1043890932593987624/1130802621750448160/1143083373535973406
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dbUrl } from "@/server/core/db";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("db");

// Destructive: this drops the entire schema. Refuse to run in production (or
// without an explicit override) so a stray `db:clean` can't wipe a live install.
if (
	process.env.NODE_ENV === "production" &&
	process.env.FORCE_DB_CLEAN !== "true"
) {
	logger.error(
		"db:clean refuses to run with NODE_ENV=production (it DROPs the schema). " +
			"Set FORCE_DB_CLEAN=true only if you really mean to wipe this database.",
	);
	process.exit(1);
}

const pg = postgres(dbUrl, { max: 1 });
const db = drizzle(pg);

const clearDb = async (): Promise<void> => {
	try {
		const tablesQuery = sql<string>`DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP schema drizzle CASCADE;`;
		const tables = await db.execute(tablesQuery);
		logger.debug({ result: tables }, "db: schema reset completed");
		await pg.end();
	} catch (error) {
		logger.error({ err: error }, "db: schema reset failed");
	}
};

clearDb();
