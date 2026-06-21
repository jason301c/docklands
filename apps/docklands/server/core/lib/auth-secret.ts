import { readSecret } from "../db/constants";

const HARDCODED_LEGACY_SECRET = "better-auth-secret-123456789";

const isNextProductionBuild = (env: NodeJS.ProcessEnv) =>
	env.NEXT_PHASE === "phase-production-build" ||
	env.npm_lifecycle_event === "build-next";

export function resolveBetterAuthSecret(
	env: NodeJS.ProcessEnv = process.env,
): string {
	if (env.BETTER_AUTH_SECRET) {
		return env.BETTER_AUTH_SECRET;
	}
	if (env.BETTER_AUTH_SECRET_FILE) {
		return readSecret(env.BETTER_AUTH_SECRET_FILE);
	}
	if (env.NODE_ENV === "production" && !isNextProductionBuild(env)) {
		throw new Error(
			"BETTER_AUTH_SECRET or BETTER_AUTH_SECRET_FILE must be set in production.",
		);
	}
	if (env.NODE_ENV !== "test" && !isNextProductionBuild(env)) {
		console.warn(`
⚠️  [DEPRECATED AUTH CONFIG]
BETTER_AUTH_SECRET is not set via environment variable or Docker secret.
Falling back to the insecure hardcoded default — this is a CRITICAL SECURITY RISK.
This fallback is only allowed in development and build-time compatibility paths.

Please migrate to Docker Secrets:
  set BETTER_AUTH_SECRET_FILE to a Docker secret containing a generated value
`);
	}
	return HARDCODED_LEGACY_SECRET;
}

export const betterAuthSecret = resolveBetterAuthSecret();
