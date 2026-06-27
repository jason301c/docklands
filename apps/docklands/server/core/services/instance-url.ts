import { createLogger } from "../lib/logger";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "./web-server-settings";

const logger = createLogger("instance-url");

const PORT = process.env.PORT || "3000";

/**
 * The instance URL — the single source of truth for "what URL is this Docklands
 * instance reachable at" — is the operator-configured `webServerSettings.host`
 * (+ `https`). That same value drives the control plane's own Traefik router and
 * Let's Encrypt certificate (see `assignDomainServer`), so it is authoritative.
 *
 * Every absolute URL the app emits about itself (invitation links, build/notify
 * links, provider OAuth + webhook callbacks, password-reset / email-verification
 * links, the passkey relying-party id, secure-cookie detection) must resolve
 * through THIS module. Nothing should reconstruct an instance URL from
 * `window.location`, raw request headers, `serverIp:PORT`, or the
 * `BETTER_AUTH_URL`/`PUBLIC_URL` env directly — `__test__/security/
 * instance-url-single-source.test.ts` fails the build if it does. Single
 * producer, zero stored copies, so the value can't drift.
 *
 * The `BETTER_AUTH_URL`/`PUBLIC_URL` env var is only a first-boot *seed* for
 * headless installs that never open the onboarding UI: `reconcileInstanceUrlEnv`
 * copies it into the DB once, then the DB is canonical forever after.
 */

type UrlSettings = {
	host?: string | null;
	https?: boolean | null;
	serverIp?: string | null;
};

/** Build the configured instance origin from settings, or null if unset. */
export const buildInstanceUrlFromSettings = (
	settings: UrlSettings | null | undefined,
): string | null => {
	const host = settings?.host?.trim();
	if (!host) return null;
	const protocol = settings?.https ? "https" : "http";
	return `${protocol}://${host}`;
};

/** The operator-configured instance URL, or null when none is configured yet. */
export const getConfiguredInstanceUrl = async (): Promise<string | null> => {
	return buildInstanceUrlFromSettings(await getWebServerSettings());
};

export const isInstanceUrlConfigured = async (): Promise<boolean> => {
	return (await getConfiguredInstanceUrl()) !== null;
};

/**
 * The canonical instance URL with a best-effort fallback for the
 * not-yet-configured case. Prefer the configured value; in development default
 * to localhost (the auto-detected public `serverIp` is meaningless for a dev
 * box); otherwise fall back to `serverIp:PORT` purely so links aren't empty —
 * surfaces should nudge the operator to configure a real URL.
 */
export const getInstanceUrl = async (): Promise<string> => {
	const configured = await getConfiguredInstanceUrl();
	if (configured) return configured;
	if (process.env.NODE_ENV !== "production") {
		return `http://localhost:${PORT}`;
	}
	const settings = await getWebServerSettings();
	if (settings?.serverIp) return `http://${settings.serverIp}:${PORT}`;
	return `http://localhost:${PORT}`;
};

type HeaderLike = {
	get: (name: string) => string | null;
};

/**
 * Request-scoped instance URL: prefer the configured value, else trust a
 * well-behaved reverse proxy / tunnel's forwarded headers. Use only where a
 * request is in hand and the instance URL may not be configured yet.
 */
export const getInstanceUrlFromHeaders = async (
	headers: HeaderLike,
): Promise<string> => {
	const configured = await getConfiguredInstanceUrl();
	if (configured) return configured;
	const proto = headers.get("x-forwarded-proto") || "http";
	const host = headers.get("x-forwarded-host") || headers.get("host");
	if (host) return `${proto}://${host}`;
	return getInstanceUrl();
};

const envInstanceUrl = (): string | undefined =>
	process.env.PUBLIC_URL || process.env.BETTER_AUTH_URL;

/**
 * Reconcile the instance URL across the env and the DB at process startup, so
 * the request-scoped link code (which reads the DB) and Better Auth (which reads
 * `process.env.BETTER_AUTH_URL` synchronously when it builds its config) agree.
 *
 * - If the DB has a configured host, it wins: mirror it into
 *   `process.env.BETTER_AUTH_URL` so auth boots from the same value.
 * - Otherwise, if the env seed is set, copy it into the DB once (host + https).
 *
 * Either way both sides hold the identical origin at boot. Changing the domain
 * later via the UI updates links immediately; Better Auth's cookie-Secure flag
 * and passkey relying-party id only re-apply on restart (they're fixed when its
 * config is built), which re-runs this reconcile.
 *
 * Must run before Better Auth's config is first built — i.e. before the server
 * accepts its first request. `process.env` is the only channel that crosses the
 * esbuild custom-server bundle and the Next route bundle, so we use it here.
 */
export const reconcileInstanceUrlEnv = async (): Promise<string | null> => {
	const settings = await getWebServerSettings();
	let canonical = buildInstanceUrlFromSettings(settings);

	if (!canonical) {
		const env = envInstanceUrl();
		if (env) {
			try {
				const url = new URL(env);
				await updateWebServerSettings({
					host: url.host,
					https: url.protocol === "https:",
				});
				canonical = `${url.protocol}//${url.host}`;
				logger.info(
					{ host: url.host },
					"Seeded instance URL from environment into web server settings",
				);
			} catch (err) {
				logger.warn(
					{ err },
					"PUBLIC_URL/BETTER_AUTH_URL is not a valid URL — ignoring instance URL seed",
				);
			}
		}
	}

	if (canonical) {
		process.env.BETTER_AUTH_URL = canonical;
	}
	return canonical;
};
