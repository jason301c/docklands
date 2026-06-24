import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { domain } from "@/shared/validations/domain";
import { applications } from "./application";
import { compose } from "./compose";
import { previewDeployments } from "./preview-deployments";
import { certificateType, ingressMode } from "./shared";

export const domainType = pgEnum("domainType", [
	"compose",
	"application",
	"preview",
]);

export const domains = pgTable(
	"domain",
	{
		domainId: text("domainId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		host: text("host").notNull(),
		https: boolean("https").notNull().default(false),
		port: integer("port").default(3000),
		customEntrypoint: text("customEntrypoint"),
		path: text("path").default("/"),
		serviceName: text("serviceName"),
		domainType: domainType("domainType").default("application"),
		uniqueConfigKey: serial("uniqueConfigKey"),
		createdAt: text("createdAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		composeId: text("composeId").references(() => compose.composeId, {
			onDelete: "cascade",
		}),
		customCertResolver: text("customCertResolver"),
		applicationId: text("applicationId").references(
			() => applications.applicationId,
			{ onDelete: "cascade" },
		),
		previewDeploymentId: text("previewDeploymentId").references(
			(): AnyPgColumn => previewDeployments.previewDeploymentId,
			{ onDelete: "cascade" },
		),
		certificateType: certificateType("certificateType")
			.notNull()
			.default("none"),
		internalPath: text("internalPath").default("/"),
		stripPath: boolean("stripPath").notNull().default(false),
		middlewares: text("middlewares").array().default(sql`ARRAY[]::text[]`),
		// How public traffic reaches this domain (see `ingressMode` enum). In
		// `tunnel` mode `tunnelId` points at the serving tunnel and
		// `cfDnsRecordId` holds the Cloudflare DNS record so it can be torn down.
		ingressMode: ingressMode("ingressMode").notNull().default("public"),
		tunnelId: text("tunnelId"),
		cfDnsRecordId: text("cfDnsRecordId"),
	},
	(t) => [
		index("domain_applicationId_idx").on(t.applicationId),
		index("domain_composeId_idx").on(t.composeId),
		index("domain_previewDeploymentId_idx").on(t.previewDeploymentId),
	],
);

export const domainsRelations = relations(domains, ({ one }) => ({
	application: one(applications, {
		fields: [domains.applicationId],
		references: [applications.applicationId],
	}),
	compose: one(compose, {
		fields: [domains.composeId],
		references: [compose.composeId],
	}),
	previewDeployment: one(previewDeployments, {
		fields: [domains.previewDeploymentId],
		references: [previewDeployments.previewDeploymentId],
	}),
}));

const createSchema = createInsertSchema(domains, {
	...domain.shape,
	// Override pgEnum so Zod 4 infers only string literals, not numeric enum index
	domainType: z.enum(["compose", "application", "preview"]).optional(),
	ingressMode: z.enum(["public", "tunnel"]).optional(),
});

export const apiCreateDomain = createSchema.pick({
	host: true,
	path: true,
	port: true,
	customEntrypoint: true,
	https: true,
	applicationId: true,
	certificateType: true,
	customCertResolver: true,
	composeId: true,
	serviceName: true,
	domainType: true,
	previewDeploymentId: true,
	internalPath: true,
	stripPath: true,
	middlewares: true,
	ingressMode: true,
});

export const apiFindDomain = z.object({
	domainId: z.string().min(1),
});

export const apiFindDomainByApplication = createSchema.pick({
	applicationId: true,
});

export const apiCreateTraefikMeDomain = createSchema.pick({}).extend({
	appName: z.string().min(1),
});

export const apiFindDomainByCompose = createSchema.pick({
	composeId: true,
});

export const apiUpdateDomain = createSchema
	.pick({
		host: true,
		path: true,
		port: true,
		customEntrypoint: true,
		https: true,
		certificateType: true,
		customCertResolver: true,
		serviceName: true,
		domainType: true,
		internalPath: true,
		stripPath: true,
		middlewares: true,
		ingressMode: true,
	})
	.extend(createSchema.pick({ domainId: true }).required().shape);
