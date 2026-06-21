import fs from "node:fs";

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
	} catch {
		throw new Error(`Cannot read secret at ${path}`);
	}
}

const isNextProductionBuild = (env: NodeJS.ProcessEnv) =>
	env.NEXT_PHASE === "phase-production-build" ||
	env.npm_lifecycle_event === "build-next";

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

	if (env.NODE_ENV === "production" && !isNextProductionBuild(env)) {
		throw new Error(
			"DATABASE_URL or POSTGRES_PASSWORD_FILE must be set in production.",
		);
	}

	if (env.NODE_ENV !== "test" && !isNextProductionBuild(env)) {
		console.warn(`
		⚠️  [DEPRECATED DATABASE CONFIG]
		You are using the legacy hardcoded database credentials.
		This fallback is only allowed in development and build-time compatibility paths.
		
		Please migrate to Docker Secrets using POSTGRES_PASSWORD_FILE.
		Generate a strong password, store it as a Docker secret, and set POSTGRES_PASSWORD_FILE.
		`);
	}

	if (env.NODE_ENV === "production") {
		return "postgres://docklands:amukds4wi9001583845717ad2@docklands-postgres:5432/docklands";
	}

	return "postgres://docklands:amukds4wi9001583845717ad2@localhost:5432/docklands";
}

export const dbUrl = resolveDbUrl();
