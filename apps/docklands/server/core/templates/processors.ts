import { randomBytes } from "node:crypto";
import path from "node:path";
import { parse, stringify } from "yaml";
import { detectDatabaseEngine } from "@/server/core/databases/detection";
import {
	DatabaseCredentialExtractionError,
	type DatabaseEngineKey,
	extractDatabaseCredentials,
} from "@/server/core/databases/registry";
import { logger } from "@/server/core/lib/logger";
import type { ComposeSpecification } from "@/server/core/utils/docker/types";
import {
	generateBase64,
	generateHash,
	generateJwt,
	generatePassword,
	generateRandomDomain,
	type Schema,
} from "./index";

type AnyRecord = Record<string, any>;

export interface TemplateDomain {
	serviceName: string;
	port: number;
	host: string;
	path?: string;
}

export interface TemplateMount {
	filePath: string;
	mountPath: string;
	content: string;
}

export interface TemplateDatabase {
	serviceName: string;
	engine: DatabaseEngineKey;
	image: string;
	/** credentials extracted from the service's resolved environment */
	config: Record<string, unknown>;
}

/** Normalize a compose service `environment` (array or map) into a record. */
const composeEnvToRecord = (environment: unknown): Record<string, string> => {
	const record: Record<string, string> = {};
	if (Array.isArray(environment)) {
		for (const entry of environment) {
			const str = String(entry);
			const eq = str.indexOf("=");
			if (eq > 0) record[str.slice(0, eq)] = str.slice(eq + 1);
		}
	} else if (environment && typeof environment === "object") {
		for (const [key, value] of Object.entries(
			environment as Record<string, unknown>,
		)) {
			record[key] = value == null ? "" : String(value);
		}
	}
	return record;
};

export interface ProcessedTemplate {
	compose: string;
	envs: string[];
	domains: TemplateDomain[];
	mounts: TemplateMount[];
	databases: TemplateDatabase[];
}

export interface ProcessComposeTemplateOptions extends Schema {
	appName: string;
	defaultPort?: number;
}

interface ParsedEnvEntry {
	key: string;
	value?: string;
	hadValue: boolean;
}

interface ComposeVariableExpression {
	raw: string;
	key: string;
	operator?: ":-" | ":?";
	defaultValue?: string;
}

type MagicVariable =
	| {
			key: string;
			type: "URL" | "FQDN";
			identifier: string;
			port?: number;
	  }
	| {
			key: string;
			type:
				| "USER"
				| "PASSWORD"
				| "PASSWORDWITHSYMBOLS"
				| "BASE64"
				| "REALBASE64"
				| "HEX"
				| "LOWERCASEUSER"
				| "SUPABASEANON_KEY"
				| "SUPABASESERVICE_KEY";
			identifier: string;
			length?: number;
	  };

const shellVariablePattern = /(?<!\$)\$([A-Za-z_][A-Za-z0-9_]*)/g;
const variableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

function randomString(length: number, alphabet: string) {
	let value = "";
	const bytes = randomBytes(length);
	for (const byte of bytes) {
		value += alphabet[byte % alphabet.length];
	}
	return value;
}

function generatePasswordWithSymbols(length = 32) {
	return randomString(
		length,
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*",
	);
}

function generateRealBase64(length = 32) {
	return randomBytes(Math.ceil((length * 3) / 4))
		.toString("base64")
		.slice(0, length);
}

function slug(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 36);
}

function dedupePush<T>(items: T[], item: T, key: (value: T) => string) {
	const id = key(item);
	if (!items.some((existing) => key(existing) === id)) {
		items.push(item);
	}
}

function setEnv(envs: Map<string, string>, key: string, value: string) {
	if (!envs.has(key)) {
		envs.set(key, value);
	}
}

function parseMagicVariable(key: string): MagicVariable | null {
	if (!key.startsWith("SERVICE_")) return null;
	const body = key.slice("SERVICE_".length);
	const urlMatch = body.match(/^(URL|FQDN)_(.+)$/);
	if (urlMatch?.[1] && urlMatch[2]) {
		const [, type, rawIdentifier] = urlMatch;
		const portMatch = rawIdentifier.match(/^(.*)_([0-9]{1,5})$/);
		const identifier = portMatch?.[1] || rawIdentifier;
		const port = portMatch?.[2] ? Number.parseInt(portMatch[2], 10) : undefined;
		return {
			key,
			type: type as "URL" | "FQDN",
			identifier,
			port,
		};
	}

	for (const type of [
		"PASSWORDWITHSYMBOLS",
		"LOWERCASEUSER",
		"PASSWORD",
		"REALBASE64",
		"BASE64",
		"HEX",
		"USER",
	] as const) {
		if (!body.startsWith(`${type}_`)) continue;
		const rest = body.slice(type.length + 1);
		const lengthMatch = rest.match(/^([0-9]{1,4})_(.+)$/);
		return {
			key,
			type,
			length: lengthMatch?.[1]
				? Number.parseInt(lengthMatch[1], 10)
				: undefined,
			identifier: lengthMatch?.[2] || rest,
		};
	}

	if (body === "SUPABASEANON_KEY" || body === "SUPABASESERVICE_KEY") {
		return {
			key,
			type: body,
			identifier: body,
		};
	}

	return null;
}

function parseComposeVariableContent(
	raw: string,
	content: string,
): ComposeVariableExpression | null {
	const defaultIndex = content.indexOf(":-");
	const requiredIndex = content.indexOf(":?");
	const indexes = [defaultIndex, requiredIndex].filter((index) => index >= 0);
	const operatorIndex = indexes.length ? Math.min(...indexes) : -1;
	const key = operatorIndex >= 0 ? content.slice(0, operatorIndex) : content;
	if (!variableNamePattern.test(key)) return null;
	if (operatorIndex < 0) {
		return { raw, key };
	}
	const operator = content.slice(operatorIndex, operatorIndex + 2) as
		| ":-"
		| ":?";
	return {
		raw,
		key,
		operator,
		defaultValue: content.slice(operatorIndex + 2),
	};
}

function extractComposeVariables(value: string) {
	const expressions: ComposeVariableExpression[] = [];
	for (let index = 0; index < value.length; index++) {
		if (
			value[index] !== "$" ||
			value[index + 1] !== "{" ||
			value[index - 1] === "$"
		) {
			continue;
		}

		let depth = 1;
		let cursor = index + 2;
		while (cursor < value.length && depth > 0) {
			if (
				value[cursor] === "$" &&
				value[cursor + 1] === "{" &&
				value[cursor - 1] !== "$"
			) {
				depth++;
				cursor += 2;
				continue;
			}
			if (value[cursor] === "}") {
				depth--;
				if (depth === 0) break;
			}
			cursor++;
		}

		if (depth !== 0) continue;
		const raw = value.slice(index, cursor + 1);
		const content = value.slice(index + 2, cursor);
		const expression = parseComposeVariableContent(raw, content);
		if (expression) expressions.push(expression);
		index = cursor;
	}
	return expressions;
}

function counterpartUrlKey(
	magic: Extract<MagicVariable, { type: "URL" | "FQDN" }>,
) {
	const parts = [
		"SERVICE",
		magic.type === "URL" ? "FQDN" : "URL",
		magic.identifier,
	];
	if (magic.port) parts.push(String(magic.port));
	return parts.join("_");
}

function formatEnvEntry(entry: ParsedEnvEntry) {
	return entry.hadValue ? `${entry.key}=${entry.value ?? ""}` : entry.key;
}

function parseEnvEntry(entry: unknown): ParsedEnvEntry | null {
	if (typeof entry === "string") {
		const separator = entry.indexOf("=");
		if (separator === -1) {
			return { key: entry.trim(), hadValue: false };
		}
		return {
			key: entry.slice(0, separator).trim(),
			value: entry.slice(separator + 1),
			hadValue: true,
		};
	}

	if (entry && typeof entry === "object" && !Array.isArray(entry)) {
		const [key, value] =
			Object.entries(entry as Record<string, unknown>)[0] || [];
		if (!key) return null;
		return {
			key,
			value: value === undefined || value === null ? "" : String(value),
			hadValue: true,
		};
	}

	return null;
}

function getServiceEnvEntries(service: AnyRecord) {
	const environment = service.environment;
	if (!environment) return [];
	if (Array.isArray(environment)) {
		return environment.map(parseEnvEntry).filter(Boolean) as ParsedEnvEntry[];
	}
	if (typeof environment === "object") {
		return Object.entries(environment).map(([key, value]) => ({
			key,
			value: value === undefined || value === null ? "" : String(value),
			hadValue: true,
		}));
	}
	return [];
}

function inferServicePort(service: AnyRecord, fallback?: number) {
	const expose = service.expose;
	if (Array.isArray(expose) && expose[0]) {
		const port = Number.parseInt(String(expose[0]).split("/")[0] || "", 10);
		if (Number.isFinite(port) && port > 0) return port;
	}

	const ports = service.ports;
	if (Array.isArray(ports) && ports[0]) {
		const raw = typeof ports[0] === "string" ? ports[0] : ports[0]?.target;
		const parts = String(raw).split(":");
		const port = Number.parseInt(parts[parts.length - 1] || "", 10);
		if (Number.isFinite(port) && port > 0) return port;
	}

	return fallback || 80;
}

function getDomainHost(
	identifier: string,
	options: ProcessComposeTemplateOptions,
	domainCache: Map<string, string>,
) {
	const normalized = slug(identifier) || "service";
	const cached = domainCache.get(normalized);
	if (cached) return cached;
	const host = generateRandomDomain({
		serverIp: options.serverIp,
		projectName: `${normalized}-${options.projectName}`,
	});
	domainCache.set(normalized, host);
	return host;
}

function resolveMagicVariable({
	magic,
	value,
	serviceName,
	service,
	options,
	envs,
	domains,
	domainCache,
	magicCache,
}: {
	magic: MagicVariable;
	value?: string;
	serviceName?: string;
	service?: AnyRecord;
	options: ProcessComposeTemplateOptions;
	envs: Map<string, string>;
	domains: TemplateDomain[];
	domainCache: Map<string, string>;
	magicCache: Map<string, string>;
}) {
	const cached = magicCache.get(magic.key);
	if (cached && (magic.type !== "URL" || !value)) return cached;

	if (magic.type === "URL" || magic.type === "FQDN") {
		const host = getDomainHost(magic.identifier, options, domainCache);
		const pathValue = value?.startsWith("/") ? value : "/";
		const port =
			magic.port ||
			(service ? inferServicePort(service, options.defaultPort) : 80);
		if (serviceName) {
			dedupePush(
				domains,
				{
					serviceName,
					port,
					host,
					path: pathValue,
				},
				(domain) =>
					`${domain.serviceName}:${domain.port}:${domain.host}:${domain.path || "/"}`,
			);
		}
		const resolved =
			magic.type === "FQDN"
				? `${host}${pathValue === "/" ? "" : pathValue}`
				: `http://${host}${pathValue === "/" ? "" : pathValue}`;
		const counterpart =
			magic.type === "FQDN"
				? `http://${host}${pathValue === "/" ? "" : pathValue}`
				: `${host}${pathValue === "/" ? "" : pathValue}`;
		const counterpartKey = counterpartUrlKey(magic);
		const aliasKey = ["SERVICE", magic.type, magic.identifier].join("_");
		const counterpartAliasKey = [
			"SERVICE",
			magic.type === "URL" ? "FQDN" : "URL",
			magic.identifier,
		].join("_");
		setEnv(envs, magic.key, resolved);
		setEnv(envs, counterpartKey, counterpart);
		setEnv(envs, aliasKey, resolved);
		setEnv(envs, counterpartAliasKey, counterpart);
		if (!magicCache.has(magic.key)) magicCache.set(magic.key, resolved);
		if (!magicCache.has(counterpartKey))
			magicCache.set(counterpartKey, counterpart);
		if (!magicCache.has(aliasKey)) magicCache.set(aliasKey, resolved);
		if (!magicCache.has(counterpartAliasKey))
			magicCache.set(counterpartAliasKey, counterpart);
		return resolved;
	}

	if (
		magic.type === "SUPABASEANON_KEY" ||
		magic.type === "SUPABASESERVICE_KEY"
	) {
		const jwtSecretKey = "SERVICE_PASSWORD_JWT";
		const jwtSecret =
			envs.get(jwtSecretKey) ||
			resolveMagicVariable({
				magic: {
					key: jwtSecretKey,
					type: "PASSWORD",
					identifier: "JWT",
				},
				options,
				envs,
				domains,
				domainCache,
				magicCache,
			});
		const resolved = generateJwt({
			secret: jwtSecret,
			payload: {
				iss: "supabase",
				role: magic.type === "SUPABASEANON_KEY" ? "anon" : "service_role",
			},
		});
		magicCache.set(magic.key, resolved);
		setEnv(envs, magic.key, resolved);
		return resolved;
	}

	const length = "length" in magic ? magic.length : undefined;
	const resolved =
		magic.type === "USER" || magic.type === "LOWERCASEUSER"
			? generatePassword(length || 16)
			: magic.type === "PASSWORD"
				? generatePassword(length || 32)
				: magic.type === "PASSWORDWITHSYMBOLS"
					? generatePasswordWithSymbols(length || 32)
					: magic.type === "BASE64"
						? randomString(
								length || 32,
								"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
							)
						: magic.type === "REALBASE64"
							? generateRealBase64(length || 32)
							: generateHash(length || 32);

	magicCache.set(magic.key, resolved);
	setEnv(envs, magic.key, resolved);
	return resolved;
}

function resolveDefaultValue(
	value: string,
	context: {
		options: ProcessComposeTemplateOptions;
		envs: Map<string, string>;
		domains: TemplateDomain[];
		domainCache: Map<string, string>;
		magicCache: Map<string, string>;
		serviceName?: string;
		service?: AnyRecord;
	},
) {
	let resolved = value;
	for (const expression of extractComposeVariables(value)) {
		const magic = parseMagicVariable(expression.key);
		if (magic) {
			resolved = resolved.replace(
				expression.raw,
				resolveMagicVariable({
					magic,
					envs: context.envs,
					domains: context.domains,
					domainCache: context.domainCache,
					magicCache: context.magicCache,
					options: context.options,
					serviceName: context.serviceName,
					service: context.service,
					value: expression.defaultValue,
				}),
			);
			continue;
		}
		if (expression.operator) {
			resolved = resolved.replace(
				expression.raw,
				resolveDefaultValue(expression.defaultValue || "", context),
			);
			continue;
		}
		if (context.envs.has(expression.key)) {
			resolved = resolved.replace(
				expression.raw,
				context.envs.get(expression.key) || "",
			);
		}
	}

	return resolved.replace(shellVariablePattern, (match, key) => {
		const magic = parseMagicVariable(key);
		if (!magic) return context.envs.get(key) || match;
		return resolveMagicVariable({
			magic,
			envs: context.envs,
			domains: context.domains,
			domainCache: context.domainCache,
			magicCache: context.magicCache,
			options: context.options,
			serviceName: context.serviceName,
			service: context.service,
		});
	});
}

function collectVariablesFromString(
	value: string,
	context: {
		options: ProcessComposeTemplateOptions;
		envs: Map<string, string>;
		domains: TemplateDomain[];
		domainCache: Map<string, string>;
		magicCache: Map<string, string>;
		serviceName?: string;
		service?: AnyRecord;
	},
) {
	for (const expression of extractComposeVariables(value)) {
		const magic = parseMagicVariable(expression.key);
		if (magic) {
			if (!context.magicCache.has(expression.key)) {
				resolveMagicVariable({
					magic,
					envs: context.envs,
					domains: context.domains,
					domainCache: context.domainCache,
					magicCache: context.magicCache,
					options: context.options,
					serviceName: context.serviceName,
					service: context.service,
					value: expression.defaultValue,
				});
			}
			continue;
		}
		if (!context.envs.has(expression.key)) {
			context.envs.set(
				expression.key,
				expression.operator
					? resolveDefaultValue(expression.defaultValue || "", context)
					: "",
			);
		}
	}

	for (const match of value.matchAll(shellVariablePattern)) {
		const [, key] = match;
		if (!key || context.envs.has(key)) continue;
		const magic = parseMagicVariable(key);
		if (magic) {
			resolveMagicVariable({
				magic,
				envs: context.envs,
				domains: context.domains,
				domainCache: context.domainCache,
				magicCache: context.magicCache,
				options: context.options,
				serviceName: context.serviceName,
				service: context.service,
			});
		}
	}
}

function walkStrings(value: unknown, visitor: (value: string) => void) {
	if (typeof value === "string") {
		visitor(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) walkStrings(item, visitor);
		return;
	}
	if (value && typeof value === "object") {
		for (const item of Object.values(value)) walkStrings(item, visitor);
	}
}

function templateFilePathFromSource(source: string) {
	const withoutProtocol = source.replace(/^type=bind,/, "");
	const normalized = path.posix.normalize(withoutProtocol.replace(/^\.\//, ""));
	if (
		normalized.startsWith("../") ||
		normalized === ".." ||
		path.posix.isAbsolute(normalized)
	) {
		throw new Error(`Unsafe template file path: ${source}`);
	}
	return normalized;
}

function rewriteCustomVolumes(service: AnyRecord, mounts: TemplateMount[]) {
	if (!Array.isArray(service.volumes)) return;

	service.volumes = service.volumes.map((volume: unknown) => {
		if (!volume || typeof volume !== "object" || Array.isArray(volume)) {
			return volume;
		}
		const record = { ...(volume as AnyRecord) };
		const hasContent = typeof record.content === "string";
		const isDirectory = Boolean(record.is_directory || record.isDirectory);
		if (!hasContent && !isDirectory) return record;

		const source = record.source || record.src;
		const target = record.target || record.dst || record.destination;
		if (typeof source !== "string") return record;

		const filePath = templateFilePathFromSource(source);
		const mountedFilePath = isDirectory
			? `${filePath.replace(/\/$/, "")}/`
			: filePath;
		dedupePush(
			mounts,
			{
				filePath: mountedFilePath,
				mountPath: typeof target === "string" ? target : "",
				content: hasContent ? record.content : "",
			},
			(mount) => mount.filePath,
		);

		record.source = `../files/${filePath}`;
		delete record.content;
		delete record.is_directory;
		delete record.isDirectory;
		return record;
	});
}

function processServiceEnvironment({
	serviceName,
	service,
	options,
	envs,
	domains,
	domainCache,
	magicCache,
}: {
	serviceName: string;
	service: AnyRecord;
	options: ProcessComposeTemplateOptions;
	envs: Map<string, string>;
	domains: TemplateDomain[];
	domainCache: Map<string, string>;
	magicCache: Map<string, string>;
}) {
	const entries = getServiceEnvEntries(service);
	if (!entries.length) return;

	for (const entry of entries) {
		const magic = parseMagicVariable(entry.key);
		if (
			magic &&
			(magic.type === "URL" || magic.type === "FQDN") &&
			magic.port
		) {
			resolveMagicVariable({
				magic,
				value: entry.value,
				serviceName,
				service,
				options,
				envs,
				domains,
				domainCache,
				magicCache,
			});
		}
	}

	const normalized = entries.map((entry) => {
		const magic = parseMagicVariable(entry.key);
		if (!magic) {
			if (entry.value) {
				collectVariablesFromString(entry.value, {
					options,
					envs,
					domains,
					domainCache,
					magicCache,
					serviceName,
					service,
				});
			}
			return formatEnvEntry(entry);
		}

		const resolved = resolveMagicVariable({
			magic,
			value: entry.value,
			serviceName,
			service,
			options,
			envs,
			domains,
			domainCache,
			magicCache,
		});
		return `${entry.key}=${resolved}`;
	});

	service.environment = normalized;
}

/**
 * Process a string value and replace Docklands utility variables.
 * Kept as a small public helper because existing app code and tests use it.
 */
export function processValue(
	value: string,
	variables: Record<string, string>,
	schema: Schema,
): string {
	return value.replace(/\${([^}]+)}/g, (match, varName) => {
		if (varName === "domain") return generateRandomDomain(schema);
		if (varName === "base64") return generateBase64(32);
		if (varName.startsWith("base64:")) {
			const length = Number.parseInt(varName.split(":")[1], 10) || 32;
			return generateBase64(length);
		}
		if (varName === "password") return generatePassword(16);
		if (varName.startsWith("password:")) {
			const length = Number.parseInt(varName.split(":")[1], 10) || 16;
			return generatePassword(length);
		}
		if (varName === "hash") return generateHash();
		if (varName.startsWith("hash:")) {
			const length = Number.parseInt(varName.split(":")[1], 10) || 8;
			return generateHash(length);
		}
		if (varName === "uuid") return crypto.randomUUID();
		if (varName === "timestamp" || varName === "timestampms") {
			return Date.now().toString();
		}
		if (varName === "timestamps") {
			return Math.round(Date.now() / 1000).toString();
		}
		if (varName.startsWith("timestampms:")) {
			return new Date(varName.slice(12)).getTime().toString();
		}
		if (varName.startsWith("timestamps:")) {
			return Math.round(
				new Date(varName.slice(11)).getTime() / 1000,
			).toString();
		}
		if (varName === "randomPort") {
			return Math.floor(Math.random() * 65535).toString();
		}
		if (varName === "username") return generatePassword(10);
		if (varName === "email") return `${generatePassword(10)}@example.com`;
		if (varName === "jwt") return generateJwt();
		if (varName.startsWith("jwt:")) {
			const params = varName.split(":").slice(1);
			if (params.length === 1 && params[0]?.match(/^\d{1,3}$/)) {
				return generateJwt({ length: Number.parseInt(params[0], 10) });
			}
			const secret = params[0];
			let payload: string | Record<string, unknown> | undefined = params[1];
			if (typeof payload === "string" && variables[payload]) {
				payload = variables[payload];
			}
			if (
				typeof payload === "string" &&
				payload.trimStart().startsWith("{") &&
				payload.trimEnd().endsWith("}")
			) {
				try {
					payload = JSON.parse(payload);
				} catch {
					payload = undefined;
				}
			}
			return generateJwt({
				secret: secret ? variables[secret] || secret : undefined,
				payload:
					typeof payload === "object" && payload !== null ? payload : undefined,
			});
		}
		return varName in variables ? (variables[varName] ?? "") : match;
	});
}

export function processComposeTemplate(
	composeContent: string,
	options: ProcessComposeTemplateOptions,
): ProcessedTemplate {
	const composeSpec = parse(composeContent, {
		maxAliasCount: 10000,
	}) as ComposeSpecification & AnyRecord;

	if (!composeSpec?.services || typeof composeSpec.services !== "object") {
		throw new Error("Template compose file must contain a services section");
	}

	const envs = new Map<string, string>();
	const domains: TemplateDomain[] = [];
	const mounts: TemplateMount[] = [];
	const databases: TemplateDatabase[] = [];
	const domainCache = new Map<string, string>();
	const magicCache = new Map<string, string>();

	setEnv(envs, "APP_NAME", options.appName);
	setEnv(envs, "COMPOSE_PROJECT_NAME", options.appName);

	for (const [serviceName, serviceConfig] of Object.entries(
		composeSpec.services,
	)) {
		if (!serviceConfig || typeof serviceConfig !== "object") continue;
		const service = serviceConfig as AnyRecord;

		// Detection bridge: flag compose services that are managed databases so
		// they can be promoted to `service_database` (backups + connection vars).
		//
		// This is the AUTHORITATIVE detection pass. The same `detectDatabaseEngine`
		// from `databases/detection` also runs earlier in `templates/analyze.ts`,
		// but that earlier pass works on the RAW compose YAML purely to label the
		// catalog (no side effects). Here it runs after magic-variable / env
		// normalization, so it sees resolved values, and this is the pass that
		// actually promotes a service to a managed database. The two passes can
		// legitimately disagree because their inputs differ; this one wins. They are
		// intentionally kept as separate call sites — do not merge them.
		const detectedEngine =
			typeof service.image === "string"
				? detectDatabaseEngine(service.image, {
						image: service.image,
						ports: service.ports,
						environment: service.environment,
						healthcheck: service.healthcheck,
					})
				: null;
		if (detectedEngine) {
			try {
				databases.push({
					serviceName,
					engine: detectedEngine,
					image: service.image,
					config: extractDatabaseCredentials(
						detectedEngine,
						composeEnvToRecord(service.environment),
					),
				});
			} catch (error) {
				// Don't store wrong-but-plausible credentials, and don't abort the
				// whole template deploy over one un-promotable database: skip
				// promotion for this service and warn loudly instead.
				if (error instanceof DatabaseCredentialExtractionError) {
					logger.warn(
						{ serviceName, engine: detectedEngine },
						`Skipping managed-database promotion for compose service "${serviceName}": ${error.message}`,
					);
				} else {
					throw error;
				}
			}
		}
		setEnv(
			envs,
			`SERVICE_NAME_${serviceName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
			serviceName,
		);
		delete service.exclude_from_hc;
		delete service.container_name;
		processServiceEnvironment({
			serviceName,
			service,
			options,
			envs,
			domains,
			domainCache,
			magicCache,
		});
		rewriteCustomVolumes(service, mounts);
	}

	walkStrings(composeSpec, (value) => {
		collectVariablesFromString(value, {
			options,
			envs,
			domains,
			domainCache,
			magicCache,
		});
	});

	return {
		compose: stringify(composeSpec, { lineWidth: 1000 }),
		envs: Array.from(envs.entries()).map(([key, value]) => `${key}=${value}`),
		domains,
		mounts,
		databases,
	};
}
