import pino from "pino";

/**
 * Central structured logger for the Docklands backend (Node only).
 *
 * Configuration is environment-driven so the same binary behaves correctly in
 * development and production:
 *
 * - `LOG_LEVEL` sets the level (default: `debug` in dev, `info` in production).
 * - Output is human-readable (`pino-pretty`) in development and machine-readable
 *   JSON in production, so log aggregators can parse it. Override either way with
 *   `LOG_PRETTY=true|false`.
 * - `redact` is a defense-in-depth backstop that strips known secret-bearing
 *   fields (passwords, tokens, keys, connection strings, raw env maps) if they
 *   ever reach a log call. It is NOT a license to log secrets — the first rule is
 *   still "never pass secrets to the logger." Command/stderr strings that may
 *   embed secrets are redacted separately at the exec boundary
 *   (`utils/process/redactSecrets`, `utils/backups/redact`).
 *
 * Browser/client code must NOT import this module (pino is Node-only); use
 * `@/client/lib/logger` instead.
 */

const isProduction = process.env.NODE_ENV === "production";

const level = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

const usePretty =
	process.env.LOG_PRETTY !== undefined
		? process.env.LOG_PRETTY === "true"
		: !isProduction;

// Field names that commonly carry secrets. Each is redacted at the top level and
// one level deep (`*.<key>`) so the usual `{ err, config: { password } }` shapes
// are covered. pino has no recursive wildcard, so deeply nested secrets should
// still be kept out of log payloads by the caller.
const SECRET_KEYS = [
	"password",
	"passwordHash",
	"newPassword",
	"currentPassword",
	"token",
	"accessToken",
	"refreshToken",
	"idToken",
	"sessionToken",
	"apiKey",
	"apiToken",
	"secret",
	"clientSecret",
	"webhookSecret",
	"authSecret",
	"encryptionKey",
	"privateKey",
	"sshPrivateKey",
	"databaseUrl",
	"DATABASE_URL",
	"connectionString",
	"authorization",
	"Authorization",
	"cookie",
	"Cookie",
	"env",
];

const redactPaths = Array.from(
	new Set([
		...SECRET_KEYS.flatMap((key) => [key, `*.${key}`]),
		"req.headers.authorization",
		"req.headers.cookie",
	]),
);

const options: pino.LoggerOptions = {
	level,
	redact: { paths: redactPaths, censor: "[REDACTED]" },
	// Serialize both `err` (pino convention) and `error` (the key already used by
	// existing call sites) into full error objects with cause chains.
	serializers: {
		err: pino.stdSerializers.err,
		error: pino.stdSerializers.err,
	},
};

if (usePretty) {
	options.transport = {
		target: "pino-pretty",
		options: {
			colorize: true,
			levelFirst: false,
			ignore: "pid,hostname",
		},
	};
}

export const logger = pino(options);

/**
 * Create a child logger bound to a module name (and optional extra context) so
 * log lines are attributable to a subsystem:
 *
 *   const log = createLogger("docker");
 *   log.error({ err, appName }, "Failed to pull image");
 *
 * Prefer one module logger per file over the bare `logger` so every line carries
 * a `module` field.
 */
export const createLogger = (
	module: string,
	bindings?: Record<string, unknown>,
) => logger.child({ module, ...bindings });
