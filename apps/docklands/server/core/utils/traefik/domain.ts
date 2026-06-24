import type { Domain } from "@/server/core/services/domain";
import type { ApplicationNested } from "../builders";
import {
	createServiceConfig,
	loadOrCreateConfig,
	loadOrCreateConfigRemote,
	removeTraefikConfig,
	removeTraefikConfigRemote,
	writeTraefikConfig,
	writeTraefikConfigRemote,
} from "./application";
import type { FileConfig, HttpRouter } from "./file-types";
import { createPathMiddlewares, removePathMiddlewares } from "./middleware";

export const manageDomain = async (app: ApplicationNested, domain: Domain) => {
	const { appName } = app;
	let config: FileConfig;

	if (app.runtimeWorkerId) {
		config = await loadOrCreateConfigRemote(app.runtimeWorkerId, appName);
	} else {
		config = loadOrCreateConfig(appName);
	}
	const serviceName = `${appName}-service-${domain.uniqueConfigKey}`;
	const routerName = `${appName}-router-${domain.uniqueConfigKey}`;
	const routerNameSecure = `${appName}-router-websecure-${domain.uniqueConfigKey}`;

	config.http = config.http || { routers: {}, services: {} };
	config.http.routers = config.http.routers || {};
	config.http.services = config.http.services || {};

	config.http.routers[routerName] = await createRouterConfig(
		app,
		domain,
		domain.customEntrypoint || "web",
	);

	if (!domain.customEntrypoint && domain.https) {
		config.http.routers[routerNameSecure] = await createRouterConfig(
			app,
			domain,
			"websecure",
		);
	} else {
		delete config.http.routers[routerNameSecure];
	}

	config.http.services[serviceName] = createServiceConfig(appName, domain);

	await createPathMiddlewares(app, domain);

	if (app.runtimeWorkerId) {
		await writeTraefikConfigRemote(config, appName, app.runtimeWorkerId);
	} else {
		writeTraefikConfig(config, appName);
	}
};

export const removeDomain = async (
	application: ApplicationNested,
	uniqueKey: number,
) => {
	const { appName, runtimeWorkerId } = application;
	let config: FileConfig;

	if (runtimeWorkerId) {
		config = await loadOrCreateConfigRemote(runtimeWorkerId, appName);
	} else {
		config = loadOrCreateConfig(appName);
	}

	const routerKey = `${appName}-router-${uniqueKey}`;
	const routerSecureKey = `${appName}-router-websecure-${uniqueKey}`;

	const serviceKey = `${appName}-service-${uniqueKey}`;
	if (config.http?.routers?.[routerKey]) {
		delete config.http.routers[routerKey];
	}
	if (config.http?.routers?.[routerSecureKey]) {
		delete config.http.routers[routerSecureKey];
	}
	if (config.http?.services?.[serviceKey]) {
		delete config.http.services[serviceKey];
	}

	await removePathMiddlewares(application, uniqueKey);

	// verify if is the last router if so we delete the router
	if (
		config?.http?.routers &&
		Object.keys(config?.http?.routers).length === 0
	) {
		if (runtimeWorkerId) {
			await removeTraefikConfigRemote(appName, runtimeWorkerId);
		} else {
			await removeTraefikConfig(appName);
		}
	} else {
		if (runtimeWorkerId) {
			await writeTraefikConfigRemote(config, appName, runtimeWorkerId);
		} else {
			writeTraefikConfig(config, appName);
		}
	}
};

/**
 * Converts an internationalized domain name (IDN) to ASCII punycode format.
 * Traefik requires domain names in ASCII format, so non-ASCII characters
 * must be converted (e.g., "тест.рф" → "xn--e1aybc.xn--p1ai").
 */
const toPunycode = (host: string): string => {
	try {
		return new URL(`http://${host}`).hostname;
	} catch {
		// If URL parsing fails, return the original host
		return host;
	}
};

// Host/path values are interpolated into Traefik's backtick-quoted matcher
// syntax (`Host(`<host>`) && PathPrefix(`<path>`)`). A backtick closes the
// matcher early, so a value containing one — or whitespace/parens — could append
// extra matchers (e.g. `evil.com`) || HostRegexp(`.+`)`) and turn one router
// into a catch-all. Traefik provides no way to escape a backtick inside a
// backtick literal, so the only safe handling is to reject such values. The
// tRPC/OpenAPI input schema already rejects them, but internal callers
// (preview-deployment `previewPath`/`previewWildcard`, traefik.me generation)
// reach this builder without going through that schema, so re-validate here as
// the last line of defense before the value lands in the generated config.
const RULE_BREAKING_CHARS = /[`\s()]/;

const assertSafeRuleValue = (kind: "host" | "path", value: string): void => {
	if (RULE_BREAKING_CHARS.test(value)) {
		throw new Error(
			`Refusing to build Traefik rule: ${kind} contains illegal characters`,
		);
	}
};

// Traefik middleware references are plain identifiers (`name` or `name@provider`).
// Reject anything else so a crafted middleware name can't smuggle YAML or rule
// metacharacters into the router's `middlewares` list.
const MIDDLEWARE_NAME_REGEX = /^[A-Za-z0-9_.-]+(@[A-Za-z0-9_.-]+)?$/;

const assertSafeMiddlewareName = (name: string): void => {
	if (!MIDDLEWARE_NAME_REGEX.test(name)) {
		throw new Error(
			"Refusing to build Traefik rule: middleware name contains illegal characters",
		);
	}
};

export const createRouterConfig = async (
	app: ApplicationNested,
	domain: Domain,
	entryPoint: string,
) => {
	const { appName, redirects, security } = app;
	const { certificateType } = domain;

	const {
		host,
		path,
		https,
		uniqueConfigKey,
		internalPath,
		stripPath,
		customEntrypoint,
	} = domain;
	const punycodeHost = toPunycode(host);
	assertSafeRuleValue("host", punycodeHost);
	const hasPathPrefix = path !== null && path !== "/";
	if (hasPathPrefix && path) {
		assertSafeRuleValue("path", path);
	}
	const routerConfig: HttpRouter = {
		rule: `Host(\`${punycodeHost}\`)${hasPathPrefix ? ` && PathPrefix(\`${path}\`)` : ""}`,
		service: `${appName}-service-${uniqueConfigKey}`,
		middlewares: [],
		entryPoints: [entryPoint],
	};

	const isRedirectRouter = entryPoint === "web" && https && !customEntrypoint;

	// Web router with HTTPS only needs redirect — all other middlewares
	// run on the websecure router where the request actually lands.
	if (isRedirectRouter) {
		routerConfig.middlewares?.push("redirect-to-https");
	} else {
		// Add path rewriting middleware if needed
		// stripPrefix must come before addPrefix so Traefik strips the
		// public path first, then prepends the internal path.
		if (stripPath && path && path !== "/") {
			const stripMiddleware = `stripprefix-${appName}-${uniqueConfigKey}`;
			routerConfig.middlewares?.push(stripMiddleware);
		}

		if (internalPath && internalPath !== "/" && internalPath !== path) {
			const pathMiddleware = `addprefix-${appName}-${uniqueConfigKey}`;
			routerConfig.middlewares?.push(pathMiddleware);
		}

		// redirects - skip for preview deployments as wildcard subdomains
		// should not inherit parent redirect rules (e.g., www-redirect)
		if (domain.domainType !== "preview") {
			for (const redirect of redirects) {
				const middlewareName = `redirect-${appName}-${redirect.uniqueConfigKey}`;
				routerConfig.middlewares?.push(middlewareName);
			}
		}

		// security
		if (security.length > 0) {
			let middlewareName = `auth-${appName}`;
			if (domain.domainType === "preview") {
				middlewareName = `auth-${appName.replace(
					/^preview-(.+)-[^-]+$/,
					"$1",
				)}`;
			}
			routerConfig.middlewares?.push(middlewareName);
		}

		// custom middlewares from domain
		if (domain.middlewares && domain.middlewares.length > 0) {
			for (const middlewareName of domain.middlewares) {
				assertSafeMiddlewareName(middlewareName);
			}
			routerConfig.middlewares?.push(...domain.middlewares);
		}
	}

	if (entryPoint === "websecure" || (customEntrypoint && https)) {
		if (certificateType === "letsencrypt") {
			routerConfig.tls = { certResolver: "letsencrypt" };
		} else if (certificateType === "custom" && domain.customCertResolver) {
			routerConfig.tls = { certResolver: domain.customCertResolver };
		} else if (certificateType === "none") {
			routerConfig.tls = undefined;
		}
	}

	return routerConfig;
};
