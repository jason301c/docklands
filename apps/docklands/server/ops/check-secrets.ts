import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("ops:check-secrets");

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
 * NOTE: this script never logs the secret VALUES — only whether each is present.
 */

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
	logger.info(
		"Skipping secret preflight (not production; setup generates secrets in dev)",
	);
	process.exit(0);
}

const hasAuthSecret = Boolean(
	process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET_FILE,
);
const hasEncryptionKey = Boolean(
	process.env.DOCKLANDS_ENCRYPTION_KEY ||
		process.env.DOCKLANDS_ENCRYPTION_KEY_FILE,
);

const missing: string[] = [];
if (!hasAuthSecret) {
	missing.push("BETTER_AUTH_SECRET (or BETTER_AUTH_SECRET_FILE)");
}
if (!hasEncryptionKey) {
	missing.push("DOCKLANDS_ENCRYPTION_KEY (or DOCKLANDS_ENCRYPTION_KEY_FILE)");
}

if (missing.length > 0) {
	logger.fatal(
		{ missing },
		"Refusing to start: required secrets are not configured",
	);

	// Deliberate plain stderr banner so the failure is unmissable in container
	// logs even when structured logging is shipped elsewhere. No secret values
	// are printed — only the names of the variables that must be set.
	console.error("\n========================================");
	console.error(" Docklands cannot start: missing secrets");
	console.error("========================================");
	for (const name of missing) {
		console.error(`  - ${name}`);
	}
	console.error(
		"\nSet the variable(s) above in the environment (or via a *_FILE path)\n" +
			"before starting Docklands. The Better Auth secret signs sessions and\n" +
			"the encryption key protects secrets stored at rest, so both are required\n" +
			"in production.\n",
	);
	process.exit(1);
}

logger.info("Secret preflight passed");
process.exit(0);
