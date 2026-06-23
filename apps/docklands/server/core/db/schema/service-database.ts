import { relations } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { DATABASE_ENGINE_KEYS } from "@/server/core/databases/registry";
import { compose } from "./compose";
import { databaseEngine } from "./database";

/**
 * A database detected *inside* a compose stack (Coolify's `ServiceDatabase`).
 * Distinct from the first-class `database` table: its lifecycle is owned by the
 * compose, but it is a first-class citizen for backups and connection
 * variables. Created automatically when a template/compose is instantiated and
 * the engine registry detects a database image among its services.
 */
export const serviceDatabase = pgTable("service_database", {
	serviceDatabaseId: text("serviceDatabaseId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	composeId: text("composeId")
		.notNull()
		.references(() => compose.composeId, { onDelete: "cascade" }),
	/** the service key inside the compose file */
	serviceName: text("serviceName").notNull(),
	/** detected engine (may be overridden manually) */
	engine: databaseEngine("engine").notNull(),
	image: text("image").notNull(),
	/** whether this detected DB is managed (backups / connection variables) */
	managed: text("managed").notNull().default("true"),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const serviceDatabaseRelations = relations(
	serviceDatabase,
	({ one }) => ({
		compose: one(compose, {
			fields: [serviceDatabase.composeId],
			references: [compose.composeId],
		}),
	}),
);

const createSchema = createInsertSchema(serviceDatabase, {
	serviceDatabaseId: z.string(),
	composeId: z.string(),
	serviceName: z.string().min(1),
	engine: z.enum(DATABASE_ENGINE_KEYS),
	image: z.string().min(1),
	managed: z.string().optional(),
	createdAt: z.string().optional(),
});

export const apiCreateServiceDatabase = createSchema.pick({
	composeId: true,
	serviceName: true,
	engine: true,
	image: true,
});

export const apiFindOneServiceDatabase = z.object({
	serviceDatabaseId: z.string().min(1),
});
