import { relations } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";
import { environments } from "./environment";
import { workspaceTags } from "./tag";

export const workspaces = pgTable("workspace", {
	workspaceId: text("workspaceId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	description: text("description"),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),

	organizationId: text("organizationId")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	env: text("env").notNull().default(""),
	// Optional accent color (hex) used to tint the workspace card on the overview.
	color: text("color"),
});

export const workspaceRelations = relations(workspaces, ({ many, one }) => ({
	environments: many(environments),
	workspaceTags: many(workspaceTags),
	organization: one(organization, {
		fields: [workspaces.organizationId],
		references: [organization.id],
	}),
}));

const createSchema = createInsertSchema(workspaces, {
	workspaceId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex value")
		.nullable()
		.optional(),
});

export const apiCreateWorkspace = createSchema.pick({
	name: true,
	description: true,
	env: true,
});

export const apiFindOneWorkspace = z.object({
	workspaceId: z.string().min(1),
});
export const apiRemoveWorkspace = createSchema
	.pick({
		workspaceId: true,
	})
	.required();

export const apiUpdateWorkspace = createSchema.partial().extend({
	workspaceId: z.string().min(1),
});
