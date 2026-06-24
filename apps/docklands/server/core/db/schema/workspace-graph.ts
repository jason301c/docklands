import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, text, unique } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { z } from "zod";
import { environments } from "./environment";

export const workspaceServiceType = pgEnum("workspaceServiceType", [
	"application",
	"compose",
	"libsql",
	"mariadb",
	"mongo",
	"mysql",
	"postgres",
	"redis",
]);

// Named, colored container regions on the canvas (e.g. "apps", "infra", "sync").
// A group is its own positioned/sized node; services reference it via
// `workspace_service_layout.groupId` (membership metadata) while keeping their
// absolute positions — so grouping never perturbs node coordinates.
export const workspaceServiceGroups = pgTable("workspace_service_group", {
	groupId: text("groupId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	environmentId: text("environmentId")
		.notNull()
		.references(() => environments.environmentId, { onDelete: "cascade" }),
	name: text("name").notNull(),
	// Optional accent color (hex/token); the UI falls back to a default tint.
	color: text("color"),
	x: integer("x").notNull(),
	y: integer("y").notNull(),
	width: integer("width").notNull().default(420),
	height: integer("height").notNull().default(320),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updatedAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const workspaceServiceLayouts = pgTable(
	"workspace_service_layout",
	{
		layoutId: text("layoutId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		environmentId: text("environmentId")
			.notNull()
			.references(() => environments.environmentId, { onDelete: "cascade" }),
		serviceType: workspaceServiceType("serviceType").notNull(),
		serviceId: text("serviceId").notNull(),
		// Optional membership in a named group; cleared if the group is deleted.
		groupId: text("groupId").references(() => workspaceServiceGroups.groupId, {
			onDelete: "set null",
		}),
		x: integer("x").notNull(),
		y: integer("y").notNull(),
		width: integer("width").notNull().default(280),
		height: integer("height").notNull().default(164),
		createdAt: text("createdAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updatedAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		uniqueServiceLayout: unique("unique_workspace_service_layout").on(
			table.environmentId,
			table.serviceType,
			table.serviceId,
		),
	}),
);

export const workspaceServiceConnections = pgTable(
	"workspace_service_connection",
	{
		connectionId: text("connectionId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		environmentId: text("environmentId")
			.notNull()
			.references(() => environments.environmentId, { onDelete: "cascade" }),
		sourceServiceType: workspaceServiceType("sourceServiceType").notNull(),
		sourceServiceId: text("sourceServiceId").notNull(),
		targetServiceType: workspaceServiceType("targetServiceType").notNull(),
		targetServiceId: text("targetServiceId").notNull(),
		label: text("label"),
		createdAt: text("createdAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updatedAt")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		uniqueServiceConnection: unique("unique_workspace_service_connection").on(
			table.environmentId,
			table.sourceServiceType,
			table.sourceServiceId,
			table.targetServiceType,
			table.targetServiceId,
		),
	}),
);

export const workspaceServiceGroupRelations = relations(
	workspaceServiceGroups,
	({ one, many }) => ({
		environment: one(environments, {
			fields: [workspaceServiceGroups.environmentId],
			references: [environments.environmentId],
		}),
		layouts: many(workspaceServiceLayouts),
	}),
);

export const workspaceServiceLayoutRelations = relations(
	workspaceServiceLayouts,
	({ one }) => ({
		environment: one(environments, {
			fields: [workspaceServiceLayouts.environmentId],
			references: [environments.environmentId],
		}),
		group: one(workspaceServiceGroups, {
			fields: [workspaceServiceLayouts.groupId],
			references: [workspaceServiceGroups.groupId],
		}),
	}),
);

export const workspaceServiceConnectionRelations = relations(
	workspaceServiceConnections,
	({ one }) => ({
		environment: one(environments, {
			fields: [workspaceServiceConnections.environmentId],
			references: [environments.environmentId],
		}),
	}),
);

export const apiWorkspaceServiceRef = z.object({
	serviceId: z.string().min(1),
	serviceType: z.enum(workspaceServiceType.enumValues),
});

export const apiFindWorkspace = z.object({
	environmentId: z.string().min(1),
});

export const apiUpdateWorkspaceNode = apiWorkspaceServiceRef.extend({
	environmentId: z.string().min(1),
	x: z.number().int(),
	y: z.number().int(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
});

export const apiCreateWorkspaceGroup = z.object({
	environmentId: z.string().min(1),
	name: z.string().trim().min(1).max(60),
	color: z.string().trim().max(32).optional(),
	x: z.number().int(),
	y: z.number().int(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
});

export const apiUpdateWorkspaceGroup = z.object({
	groupId: z.string().min(1),
	name: z.string().trim().min(1).max(60).optional(),
	color: z.string().trim().max(32).nullish(),
	x: z.number().int().optional(),
	y: z.number().int().optional(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
});

export const apiRemoveWorkspaceGroup = z.object({
	groupId: z.string().min(1),
});

export const apiAssignWorkspaceServiceGroup = apiWorkspaceServiceRef.extend({
	environmentId: z.string().min(1),
	// null clears membership (remove from its group).
	groupId: z.string().min(1).nullable(),
});

export const apiCreateWorkspaceConnection = z.object({
	environmentId: z.string().min(1),
	source: apiWorkspaceServiceRef,
	target: apiWorkspaceServiceRef,
	label: z.string().trim().max(120).optional(),
	applyVariables: z.boolean().optional().default(false),
});

export const apiRemoveWorkspaceConnection = z.object({
	connectionId: z.string().min(1),
});

export const apiWorkspaceConnectionVariables = z.object({
	connectionId: z.string().min(1),
});

export const apiSyncWorkspaceServiceConnectionVariables = z.object({
	environmentId: z.string().min(1),
	serviceId: z.string().min(1),
	serviceType: z.enum(workspaceServiceType.enumValues),
});
