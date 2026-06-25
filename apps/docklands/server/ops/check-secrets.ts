import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("ops:check-secrets");
const ENCRYPTION_KEY_BYTES = 32;

type EnvLike = Partial<Record<string, string>>;
type SecretReader = (path: string) => string;

type SecretSource = {
	label: string;
	envName: string;
	fileName: string;
};

export type SecretPreflightProblem = {
	name: string;
	message: string;
};

/**
 * First-install secret preflight. Runs before migrations and the server in
 * production (`start`) to fail fast with an actionable message when the instance
 * is missing the secrets it cannot operate safely without:
 *
 * - A Better Auth secret (`BETTER_AUTH_SECRET` or `BETTER_AUTH_SECRET_FILE`),
 *   which signs sessions.
 * - An encryption key (`DOCKLANDS_ENCRYPTION_KEY` or
 *   `DOCKLANDS_ENCRYPTION_KEY_FILE`), which protects every secret stored at rest.
 *
 * In development the `setup` script generates both (see `ensure-auth-secret.ts`
 * and `ensure-encryption-key.ts`), so this check only enforces in production.
 *
 * NOTE: this script never logs secret VALUES — only variable names and
 * validation problems.
 */

const readSecretFile: SecretReader = (path) =>
	readFileSync(path, "utf8").trim();

const configured = (value: string | undefined) => Boolean(value?.trim());

const validateSingleSecretSource = (
	env: EnvLike,
	source: SecretSource,
	readSecret: SecretReader,
	problems: SecretPreflightProblem[],
) => {
	const envValue = env[source.envName];
	const filePath = env[source.fileName];
	const hasEnvValue = configured(envValue);
	const hasFilePath = configured(filePath);

	if (hasEnvValue && hasFilePath) {
		problems.push({
			name: source.label,
			message: `Set either ${source.envName} or ${source.fileName}, not both.`,
		});
		return;
	}

	if (hasEnvValue) {
		return envValue?.trim();
	}

	if (!hasFilePath) {
		problems.push({
			name: source.label,
			message: `Set ${source.envName} or ${source.fileName}.`,
		});
		return;
	}

	try {
		const secret = readSecret(filePath as string).trim();
		if (!secret) {
			problems.push({
				name: source.fileName,
				message: "Secret file is readable but empty.",
			});
			return;
		}
		return secret;
	} catch (error) {
		problems.push({
			name: source.fileName,
			message:
				error instanceof Error
					? `Secret file cannot be read: ${error.message}`
					: "Secret file cannot be read.",
		});
	}
};

const validateEncryptionKey = (
	raw: string | undefined,
	problems: SecretPreflightProblem[],
) => {
	if (!raw) {
		return;
	}

	const key = Buffer.from(raw.trim(), "base64");
	if (key.length !== ENCRYPTION_KEY_BYTES) {
		problems.push({
			name: "DOCKLANDS_ENCRYPTION_KEY",
			message: `Must decode to ${ENCRYPTION_KEY_BYTES} bytes. Generate one with: openssl rand -base64 32`,
		});
	}
};

const validateDatabaseConfig = (
	env: EnvLike,
	readSecret: SecretReader,
	problems: SecretPreflightProblem[],
) => {
	const databaseUrl = env.DATABASE_URL;
	const passwordFile = env.POSTGRES_PASSWORD_FILE;
	const hasDatabaseUrl = configured(databaseUrl);
	const hasPasswordFile = configured(passwordFile);

	if (hasDatabaseUrl && hasPasswordFile) {
		problems.push({
			name: "DATABASE_URL",
			message:
				"Set either DATABASE_URL or POSTGRES_PASSWORD_FILE, not both. DATABASE_URL takes precedence at runtime, so both sources would be ambiguous.",
		});
		return;
	}

	if (!hasDatabaseUrl && !hasPasswordFile) {
		problems.push({
			name: "DATABASE_URL",
			message: "Set DATABASE_URL or POSTGRES_PASSWORD_FILE.",
		});
		return;
	}

	if (hasDatabaseUrl) {
		try {
			const parsed = new URL(databaseUrl as string);
			if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
				problems.push({
					name: "DATABASE_URL",
					message:
						"DATABASE_URL must use the postgres:// or postgresql:// scheme.",
				});
			}
			if (!parsed.hostname) {
				problems.push({
					name: "DATABASE_URL",
					message: "DATABASE_URL must include a host.",
				});
			}
			if (!parsed.pathname || parsed.pathname === "/") {
				problems.push({
					name: "DATABASE_URL",
					message: "DATABASE_URL must include a database name.",
				});
			}
		} catch {
			problems.push({
				name: "DATABASE_URL",
				message: "DATABASE_URL must be a valid Postgres connection URL.",
			});
		}
		return;
	}

	try {
		const password = readSecret(passwordFile as string).trim();
		if (!password) {
			problems.push({
				name: "POSTGRES_PASSWORD_FILE",
				message: "Secret file is readable but empty.",
			});
		}
	} catch (error) {
		problems.push({
			name: "POSTGRES_PASSWORD_FILE",
			message:
				error instanceof Error
					? `Secret file cannot be read: ${error.message}`
					: "Secret file cannot be read.",
		});
	}
};

export const validateProductionSecrets = (
	env: EnvLike = process.env,
	readSecret: SecretReader = readSecretFile,
): SecretPreflightProblem[] => {
	const problems: SecretPreflightProblem[] = [];
	const encryptionKey = validateSingleSecretSource(
		env,
		{
			label: "Encryption key",
			envName: "DOCKLANDS_ENCRYPTION_KEY",
			fileName: "DOCKLANDS_ENCRYPTION_KEY_FILE",
		},
		readSecret,
		problems,
	);

	validateSingleSecretSource(
		env,
		{
			label: "Better Auth secret",
			envName: "BETTER_AUTH_SECRET",
			fileName: "BETTER_AUTH_SECRET_FILE",
		},
		readSecret,
		problems,
	);
	validateEncryptionKey(encryptionKey, problems);
	validateDatabaseConfig(env, readSecret, problems);

	return problems;
};

const isEntrypoint = () => {
	const entrypoint = process.argv[1];
	return Boolean(
		entrypoint && import.meta.url === pathToFileURL(entrypoint).href,
	);
};

export const runSecretPreflight = () => {
	const isProduction = process.env.NODE_ENV === "production";

	if (!isProduction) {
		logger.info(
			"Skipping secret preflight (not production; setup generates secrets in dev)",
		);
		process.exit(0);
	}

	const problems = validateProductionSecrets(process.env);

	if (problems.length > 0) {
		logger.fatal(
			{ problems },
			"Refusing to start: required production secrets are not configured correctly",
		);

		// Deliberate plain stderr banner so the failure is unmissable in container
		// logs even when structured logging is shipped elsewhere. No secret values
		// are printed — only the names of the variables that must be fixed.
		console.error("\n======================================================");
		console.error(" Docklands cannot start: invalid secret configuration");
		console.error("======================================================");
		for (const problem of problems) {
			console.error(`  - ${problem.name}: ${problem.message}`);
		}
		console.error(
			"\nFix the variable(s) above before starting Docklands. The Better Auth\n" +
				"secret signs sessions, the encryption key protects secrets stored at\n" +
				"rest, and the database configuration must resolve before migrations run.\n",
		);
		process.exit(1);
	}

	logger.info("Secret preflight passed");
	process.exit(0);
};

if (isEntrypoint()) {
	runSecretPreflight();
}
