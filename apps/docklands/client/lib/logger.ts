/**
 * Browser-safe logger for client components, hooks, and `"use client"` code.
 *
 * The Node pino logger (`@/server/core/lib/logger`) must never be imported into
 * client code. This is a thin, consistent wrapper over `console` so client
 * logging is uniform and quiet in production:
 *
 * - `debug` / `info` are development-only (no-ops in production builds) — use
 *   them for diagnostics.
 * - `warn` / `error` always emit — use them when something actually failed
 *   (a mutation, fetch, subscription, or parse), even when the user already sees
 *   a toast, so the failure is visible in the browser console / error reporting.
 *
 * Never log secrets, tokens, or session material from the browser.
 *
 *   const log = createClientLogger("workspace");
 *   log.error("Failed to create service", err);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";

const enabled: Record<LogLevel, boolean> = {
	debug: !isProduction,
	info: !isProduction,
	warn: true,
	error: true,
};

// This wrapper is the one sanctioned place client code is allowed to touch
// `console` directly; everywhere else should import `createClientLogger`.
const sink: Record<LogLevel, (...args: unknown[]) => void> = {
	debug: (...args) => console.debug(...args),
	info: (...args) => console.info(...args),
	warn: (...args) => console.warn(...args),
	error: (...args) => console.error(...args),
};

const emit = (level: LogLevel, scope: string | undefined, args: unknown[]) => {
	if (!enabled[level]) return;
	sink[level](`[${scope ?? "docklands"}]`, ...args);
};

export interface ClientLogger {
	debug: (...args: unknown[]) => void;
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
}

export const createClientLogger = (scope?: string): ClientLogger => ({
	debug: (...args) => emit("debug", scope, args),
	info: (...args) => emit("info", scope, args),
	warn: (...args) => emit("warn", scope, args),
	error: (...args) => emit("error", scope, args),
});

export const clientLogger = createClientLogger();
