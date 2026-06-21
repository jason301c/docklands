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

export const workspaceServiceLayoutRelations = relations(
	workspaceServiceLayouts,
	({ one }) => ({
		environment: one(environments, {
			fields: [workspaceServiceLayouts.environmentId],
			references: [environments.environmentId],
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

export const apiWorkspaceServiceEnv = z.object({
	environmentId: z.string().min(1),
	serviceId: z.string().min(1),
	serviceType: z.enum(workspaceServiceType.enumValues),
});

export const apiUpdateWorkspaceServiceEnv = apiWorkspaceServiceEnv.extend({
	env: z.string(),
});
