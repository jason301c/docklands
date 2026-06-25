const BUNDLED_POSTGRES_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"docklands-postgres",
	"",
]);

export const INSTANCE_BACKUP_BUNDLED_POSTGRES_ONLY_MESSAGE =
	"Docklands whole-instance backup and restore currently support only the bundled docklands-postgres database. External DATABASE_URL operators must back up and restore Postgres with their database provider tooling, and separately back up /etc/docklands plus DOCKLANDS_ENCRYPTION_KEY.";

type EnvLike = Partial<Record<string, string>>;

const getDatabaseHost = (env: EnvLike) => {
	if (env.DATABASE_URL) {
		try {
			return new URL(env.DATABASE_URL).hostname.toLowerCase();
		} catch {
			return "";
		}
	}

	return (env.POSTGRES_HOST ?? "docklands-postgres").toLowerCase();
};

export const usesBundledPostgresForInstanceBackup = (
	env: EnvLike = process.env,
) => {
	if (env.SKIP_BUNDLED_POSTGRES === "true") {
		return false;
	}

	return BUNDLED_POSTGRES_HOSTS.has(getDatabaseHost(env));
};

export const assertBundledPostgresForInstanceBackup = (
	env: EnvLike = process.env,
) => {
	if (!usesBundledPostgresForInstanceBackup(env)) {
		throw new Error(INSTANCE_BACKUP_BUNDLED_POSTGRES_ONLY_MESSAGE);
	}
};
