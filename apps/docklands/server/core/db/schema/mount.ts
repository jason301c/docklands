import { relations } from "drizzle-orm";
import { type AnyPgColumn, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { applications } from "./application";
import { compose } from "./compose";
import { database } from "./database";

export const serviceType = pgEnum("serviceType", [
	"application",
	"postgres",
	"mysql",
	"mariadb",
	"mongo",
	"redis",
	"compose",
	"libsql",
]);

export type ServiceType = (typeof serviceType.enumValues)[number];

export const mountType = pgEnum("mountType", ["bind", "volume", "file"]);

export const mounts = pgTable("mount", {
	mountId: text("mountId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	type: mountType("type").notNull(),
	hostPath: text("hostPath"),
	volumeName: text("volumeName"),
	filePath: text("filePath"),
	content: text("content"),
	serviceType: serviceType("serviceType").notNull().default("application"),
	mountPath: text("mountPath").notNull(),
	applicationId: text("applicationId").references(
		() => applications.applicationId,
		{ onDelete: "cascade" },
	),
	composeId: text("composeId").references(() => compose.composeId, {
		onDelete: "cascade",
	}),
	databaseId: text("databaseId").references(
		(): AnyPgColumn => database.databaseId,
		{ onDelete: "cascade" },
	),
});

export const MountssRelations = relations(mounts, ({ one }) => ({
	application: one(applications, {
		fields: [mounts.applicationId],
		references: [applications.applicationId],
	}),
	compose: one(compose, {
		fields: [mounts.composeId],
		references: [compose.composeId],
	}),
	database: one(database, {
		fields: [mounts.databaseId],
		references: [database.databaseId],
	}),
}));

const createSchema = createInsertSchema(mounts, {
	applicationId: z.string(),
	type: z.enum(["bind", "volume", "file"]),
	hostPath: z.string().nullish(),
	volumeName: z.string().nullish(),
	content: z.string().nullish(),
	mountPath: z.string().min(1),
	mountId: z.string().optional(),
	filePath: z.string().nullish(),
	serviceType: z.enum([
		"application",
		"postgres",
		"mysql",
		"mariadb",
		"mongo",
		"redis",
		"compose",
		"libsql",
	]),
});

export const apiCreateMount = createSchema
	.pick({
		type: true,
		hostPath: true,
		volumeName: true,
		content: true,
		mountPath: true,
		filePath: true,
		serviceType: true,
	})
	.extend({
		serviceId: z.string().min(1),
	});

export const apiFindOneMount = z.object({
	mountId: z.string().min(1),
});

export const apiRemoveMount = createSchema
	.pick({
		mountId: true,
	})
	// .extend({
	// 	appName: z.string().min(1),
	// })
	.required();

export const apiUpdateMount = createSchema.partial().extend({
	mountId: z.string().min(1),
});
