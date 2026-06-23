import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { TRPCError } from "@trpc/server";
import type { DatabaseEngineKey } from "@/server/core/databases/registry";
import { analyzeTemplateDatabases } from "./analyze";

export const DEFAULT_TEMPLATES_DIR =
	process.env.DOCKLANDS_TEMPLATES_DIR || join(process.cwd(), "templates");

export interface TemplateMetadata {
	id: string;
	name: string;
	description: string;
	category?: string;
	tags: string[];
	version: string;
	port?: number;
	logo: string;
	ignored?: boolean;
	links: {
		docs?: string;
		website?: string;
		github?: string;
	};
	/** managed-database engines detected among the template's services */
	databaseEngines: DatabaseEngineKey[];
	/**
	 * Set when the template is *just* a single managed database — the UI steers
	 * these to the managed-database picker instead of an opaque compose deploy.
	 */
	bareDatabaseEngine: DatabaseEngineKey | null;
}

/**
 * Cheap pre-filter: only parse the compose for database detection when the raw
 * content even mentions a database image. Avoids 300+ YAML parses for the many
 * templates that contain no database at all.
 */
const DB_IMAGE_HINTS = [
	"postgres",
	"mysql",
	"mariadb",
	"mongo",
	"redis",
	"libsql-server",
];
const mightContainDatabase = (content: string) => {
	const lower = content.toLowerCase();
	return DB_IMAGE_HINTS.some((hint) => lower.includes(hint));
};

export interface TemplateDefinition {
	metadata: TemplateMetadata;
	compose: string;
}

const TEMPLATE_EXTENSIONS = new Set([".yaml", ".yml"]);

function titleizeTemplateId(id: string) {
	return id
		.split(/[-_]/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function parseTemplateHeaders(content: string) {
	const headers: Record<string, string> = {};
	for (const line of content.split(/\r?\n/)) {
		const match = line.match(/^#\s*([^:]+):\s*(.*)$/);
		if (!match) {
			if (line.trim() && !line.trim().startsWith("#")) break;
			continue;
		}
		const [, key, value] = match;
		if (key) headers[key.trim().toLowerCase()] = value?.trim() || "";
	}
	return headers;
}

function normalizeLogoPath(logo: string | undefined) {
	if (!logo) return "/templates/svgs/default.webp";
	if (logo.startsWith("http://") || logo.startsWith("https://")) return logo;
	if (logo.startsWith("/")) return logo;
	if (logo.startsWith("svg/")) return `/templates/svgs/${logo.slice(4)}`;
	if (logo.startsWith("svgs/")) return `/templates/${logo}`;
	return `/templates/svgs/${logo}`;
}

function parseTags(value: string | undefined) {
	return (value || "")
		.split(",")
		.map((tag) => tag.trim().toLowerCase())
		.filter(Boolean);
}

function parsePort(value: string | undefined) {
	if (!value) return undefined;
	const port = Number.parseInt(value, 10);
	return Number.isFinite(port) && port > 0 ? port : undefined;
}

function parseBoolean(value: string | undefined) {
	return ["1", "true", "yes", "on"].includes((value || "").toLowerCase());
}

async function listTemplateFiles() {
	const composeDir = join(DEFAULT_TEMPLATES_DIR, "compose");
	const files = await readdir(composeDir);
	return files
		.filter((file) => TEMPLATE_EXTENSIONS.has(extname(file)))
		.sort((a, b) => a.localeCompare(b));
}

async function readTemplateFile(fileName: string) {
	const content = await readFile(
		join(DEFAULT_TEMPLATES_DIR, "compose", fileName),
		"utf8",
	);
	const id = fileName.slice(0, -extname(fileName).length);
	const headers = parseTemplateHeaders(content);
	const docs = headers.documentation || undefined;
	const port = parsePort(headers.port);

	const analysis = mightContainDatabase(content)
		? analyzeTemplateDatabases(content)
		: null;

	return {
		metadata: {
			id,
			name: titleizeTemplateId(id),
			description: headers.slogan || titleizeTemplateId(id),
			category: headers.category || undefined,
			tags: parseTags(headers.tags),
			version: headers.minversion || "0.0.0",
			port,
			logo: normalizeLogoPath(headers.logo),
			ignored: parseBoolean(headers.ignore),
			links: {
				docs,
				website: headers.website || undefined,
				github: headers.github || undefined,
			},
			databaseEngines: analysis
				? [...new Set(analysis.databases.map((d) => d.engine))]
				: [],
			bareDatabaseEngine: analysis?.bareDatabaseEngine ?? null,
		},
		compose: content,
	} satisfies TemplateDefinition;
}

export async function loadTemplateCatalog(): Promise<TemplateMetadata[]> {
	const files = await listTemplateFiles();
	const templates = await Promise.all(files.map(readTemplateFile));
	return templates
		.map((template) => template.metadata)
		.filter((template) => !template.ignored);
}

export async function loadTemplateDefinition(
	id: string,
): Promise<TemplateDefinition> {
	const files = await listTemplateFiles();
	const fileName = files.find(
		(file) => file.slice(0, -extname(file).length) === id,
	);
	if (!fileName) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Template "${id}" was not found`,
		});
	}
	const template = await readTemplateFile(fileName);
	if (template.metadata.ignored) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Template "${id}" is not available`,
		});
	}
	return template;
}
