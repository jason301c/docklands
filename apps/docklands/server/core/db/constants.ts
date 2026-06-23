import fs from "node:fs";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("db");

export const {
	DATABASE_URL,
	POSTGRES_PASSWORD_FILE,
	POSTGRES_USER = "docklands",
	POSTGRES_DB = "docklands",
	POSTGRES_HOST = "docklands-postgres",
	POSTGRES_PORT = "5432",
} = process.env;

export function readSecret(path: string): string {
	try {
		return fs.readFileSync(path, "utf8").trim();
	} catch (e) {
		logger.debug({ err: e, path }, "db: failed to read secret file");
		throw new Error(`Cannot read secret at ${path}`, { cause: e });
	}
}

const TEST_DATABASE_URL =
	"postgres://docklands:test@localhost:5432/docklands_test";

export function resolveDbUrl(env: NodeJS.ProcessEnv = process.env): string {
	const {
		DATABASE_URL,
		POSTGRES_PASSWORD_FILE,
		POSTGRES_USER = "docklands",
		POSTGRES_DB = "docklands",
		POSTGRES_HOST = "docklands-postgres",
		POSTGRES_PORT = "5432",
	} = env;

	if (DATABASE_URL) {
		return DATABASE_URL;
	}

	if (POSTGRES_PASSWORD_FILE) {
		const password = readSecret(POSTGRES_PASSWORD_FILE);
		return `postgres://${POSTGRES_USER}:${encodeURIComponent(
			password,
		)}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
	}

	if (env.NODE_ENV === "test") {
		return TEST_DATABASE_URL;
	}

	logger.fatal(
		"db: DB URL resolution failed — missing DATABASE_URL and POSTGRES_PASSWORD_FILE",
	);
	throw new Error("DATABASE_URL or POSTGRES_PASSWORD_FILE must be set.");
}

export const dbUrl = resolveDbUrl();
