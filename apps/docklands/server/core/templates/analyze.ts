import { parse } from "yaml";
import { detectDatabaseEngine } from "@/server/core/databases/detection";
import type { DatabaseEngineKey } from "@/server/core/databases/registry";

export interface TemplateDatabaseAnalysis {
	/** databases detected among the template's services */
	databases: { serviceName: string; engine: DatabaseEngineKey }[];
	/** total number of services in the compose */
	serviceCount: number;
	/**
	 * True when the template is *just* a single managed database — these should
	 * be steered to the managed-database picker rather than deployed as an opaque
	 * compose stack (the catalog boundary).
	 */
	isBareDatabase: boolean;
	/** the engine of a bare-database template, if applicable */
	bareDatabaseEngine: DatabaseEngineKey | null;
}

/**
 * Analyze a template's compose for managed databases without instantiating it
 * (no password generation, no side effects). Used to label the catalog and to
 * route bare single-database templates to the managed path.
 */
export const analyzeTemplateDatabases = (
	composeContent: string,
): TemplateDatabaseAnalysis => {
	let services: Record<string, unknown> = {};
	try {
		const spec = parse(composeContent, { maxAliasCount: 10000 }) as {
			services?: Record<string, unknown>;
		};
		if (spec?.services && typeof spec.services === "object") {
			services = spec.services;
		}
	} catch {
		/* malformed compose → treat as no databases */
	}

	const entries = Object.entries(services);
	const databases: { serviceName: string; engine: DatabaseEngineKey }[] = [];
	for (const [serviceName, raw] of entries) {
		if (!raw || typeof raw !== "object") continue;
		const service = raw as {
			image?: unknown;
			ports?: unknown;
			environment?: unknown;
			healthcheck?: unknown;
		};
		if (typeof service.image !== "string") continue;
		// Detection intentionally runs at TWO points in a template's lifecycle, both
		// through the same `detectDatabaseEngine` from `databases/detection`:
		//   1) HERE, at catalog-label time, against the RAW compose YAML (before any
		//      magic-variable / env normalization) — purely to label the catalog and
		//      route bare single-database templates. No side effects.
		//   2) At deploy time in `templates/processors.ts`, against the env that has
		//      been normalized (magic vars resolved). That pass is AUTHORITATIVE —
		//      it's the one that actually promotes a service to a managed database.
		// The two passes can legitimately disagree because their inputs differ; the
		// deploy-time pass wins. Do not collapse them into one call site.
		const engine = detectDatabaseEngine(service.image, {
			image: service.image,
			ports: service.ports,
			environment: service.environment,
			healthcheck: service.healthcheck,
		});
		if (engine) databases.push({ serviceName, engine });
	}

	const isBareDatabase = entries.length === 1 && databases.length === 1;
	return {
		databases,
		serviceCount: entries.length,
		isBareDatabase,
		bareDatabaseEngine: isBareDatabase ? (databases[0]?.engine ?? null) : null,
	};
};
