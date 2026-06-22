import { readSecret } from "../db/constants";

const TEST_BETTER_AUTH_SECRET = "docklands-test-secret-00000000000000000000";

export function resolveBetterAuthSecret(
	env: NodeJS.ProcessEnv = process.env,
): string {
	if (env.BETTER_AUTH_SECRET) {
		return env.BETTER_AUTH_SECRET;
	}
	if (env.BETTER_AUTH_SECRET_FILE) {
		return readSecret(env.BETTER_AUTH_SECRET_FILE);
	}
	if (env.NODE_ENV === "test") {
		return TEST_BETTER_AUTH_SECRET;
	}
	throw new Error("BETTER_AUTH_SECRET or BETTER_AUTH_SECRET_FILE must be set.");
}

export const betterAuthSecret = resolveBetterAuthSecret();
