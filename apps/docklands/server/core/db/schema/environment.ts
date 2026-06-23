import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { z } from "zod";
import { applications } from "./application";
import { compose } from "./compose";
import { database } from "./database";
import { workspaces } from "./workspace";
import {
	workspaceServiceConnections,
	workspaceServiceLayouts,
} from "./workspace-graph";

export const environments = pgTable(
	"environment",
	{
		environmentId: text("environmentId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		name: text("name").notNull(),
		description: text("description"),
		createdAt: text("createdAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		env: text("env").notNull().default(""),
		workspaceId: text("workspaceId")
			.notNull()
			.references(() => workspaces.workspaceId, { onDelete: "cascade" }),
		isDefault: boolean("isDefault").notNull().default(false),
	},
	(t) => [index("environment_workspaceId_idx").on(t.workspaceId)],
);

export const environmentRelations = relations(
	environments,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [environments.workspaceId],
			references: [workspaces.workspaceId],
		}),
		applications: many(applications),
		compose: many(compose),
		database: many(database),
		workspaceServiceLayouts: many(workspaceServiceLayouts),
		workspaceServiceConnections: many(workspaceServiceConnections),
	}),
);

export const apiCreateEnvironment = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	workspaceId: z.string().min(1),
});

export const apiFindOneEnvironment = z.object({
	environmentId: z.string().min(1),
});

export const apiRemoveEnvironment = z.object({
	environmentId: z.string().min(1),
});

export const apiUpdateEnvironment = z.object({
	environmentId: z.string().min(1),
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	workspaceId: z.string().optional(),
	env: z.string().optional(),
});

export const apiDuplicateEnvironment = z.object({
	environmentId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
});
