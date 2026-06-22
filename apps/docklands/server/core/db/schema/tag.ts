import { relations } from "drizzle-orm";
import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";
import { workspaces } from "./workspace";

export const tags = pgTable(
	"tag",
	{
		tagId: text("tagId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		name: text("name").notNull(),
		color: text("color"),
		createdAt: text("createdAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),

		organizationId: text("organizationId")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
	},
	(table) => ({
		// Unique index on (organizationId, name) to prevent duplicate tag names per organization
		uniqueOrgName: unique("unique_org_tag_name").on(
			table.organizationId,
			table.name,
		),
	}),
);

export const workspaceTags = pgTable(
	"workspace_tag",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		workspaceId: text("workspaceId")
			.notNull()
			.references(() => workspaces.workspaceId, { onDelete: "cascade" }),
		tagId: text("tagId")
			.notNull()
			.references(() => tags.tagId, { onDelete: "cascade" }),
	},
	(table) => ({
		// Unique constraint to prevent duplicate workspace-tag associations.
		uniqueWorkspaceTag: unique("unique_workspace_tag").on(
			table.workspaceId,
			table.tagId,
		),
	}),
);

export const tagRelations = relations(tags, ({ one, many }) => ({
	organization: one(organization, {
		fields: [tags.organizationId],
		references: [organization.id],
	}),
	workspaceTags: many(workspaceTags),
}));

export const workspaceTagRelations = relations(workspaceTags, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [workspaceTags.workspaceId],
		references: [workspaces.workspaceId],
	}),
	tag: one(tags, {
		fields: [workspaceTags.tagId],
		references: [tags.tagId],
	}),
}));

const createSchema = createInsertSchema(tags, {
	tagId: z.string().min(1),
	name: z.string().min(1),
	color: z.string().optional(),
});

export const apiCreateTag = createSchema.pick({
	name: true,
	color: true,
});

export const apiFindOneTag = z.object({
	tagId: z.string().min(1),
});

export const apiRemoveTag = createSchema
	.pick({
		tagId: true,
	})
	.required();

export const apiUpdateTag = createSchema.partial().extend({
	tagId: z.string().min(1),
});
