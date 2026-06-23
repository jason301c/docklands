import { and, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createLogger } from "@/server/core/lib/logger";
import { dbUrl } from "./constants";
import * as schema from "./schema";

export * from "./schema";
export { and, eq };

const logger = createLogger("db");

type Database = PostgresJsDatabase<typeof schema>;

/**
 * Evita problemas de redeclaración global en monorepos.
 * No usamos `declare global`.
 */
const globalForDb = globalThis as unknown as {
	db?: Database;
};

let dbConnection: Database;

if (process.env.NODE_ENV === "production") {
	// En producción no usamos global cache
	try {
		dbConnection = drizzle(postgres(dbUrl), { schema });
		logger.info({ mode: "production" }, "db: connection established");
	} catch (err) {
		logger.fatal({ err }, "db: failed to establish connection");
		throw err;
	}
} else {
	// En desarrollo reutilizamos conexión para evitar múltiples conexiones
	if (!globalForDb.db) {
		try {
			globalForDb.db = drizzle(postgres(dbUrl), { schema });
			logger.info({ mode: "dev-reuse" }, "db: connection established");
		} catch (err) {
			logger.fatal({ err }, "db: failed to establish connection");
			throw err;
		}
	}

	dbConnection = globalForDb.db;
}

export const db: Database = dbConnection;

export { dbUrl };
