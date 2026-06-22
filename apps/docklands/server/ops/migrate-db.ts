import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dbUrl } from "@/server/core/db";
import { adoptResetBaseline, repairLegacySchema } from "./repair-legacy-schema";

const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql);

try {
	await repairLegacySchema(sql);
	await adoptResetBaseline(sql);
	await migrate(db, { migrationsFolder: "drizzle" });
	console.log("Migration complete");
} catch (error) {
	console.error("Migration failed", error);
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 1 });
}
