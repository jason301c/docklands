import { relations, sql } from "drizzle-orm";
import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import { account, apikey, organization } from "./account";
import { backups } from "./backups";
import { schedules } from "./schedule";
import { workspaces } from "./workspace";

/**
 * This is an example of how to use the multi-workspace schema feature of Drizzle ORM. Use the same
 * database instance for multiple workspaces.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-workspace-schema
 */

// OLD TABLE

// TEMP
export const user = pgTable("user", {
	id: text("id")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	firstName: text("firstName").notNull().default(""),
	lastName: text("lastName").notNull().default(""),
	isRegistered: boolean("isRegistered").notNull().default(false),
	expirationDate: text("expirationDate")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	createdAt2: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	createdAt: timestamp("created_at").defaultNow(),
	// Auth
	twoFactorEnabled: boolean("two_factor_enabled"),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull(),
	image: text("image"),
	banned: boolean("banned"),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	updatedAt: timestamp("updated_at").notNull(),
	// Admin
	role: text("role").notNull().default("user"),
	// Metrics
	enablePaidFeatures: boolean("enablePaidFeatures").notNull().default(false),
	allowImpersonation: boolean("allowImpersonation").notNull().default(false),
	serversQuantity: integer("serversQuantity").notNull().default(0),
	trustedOrigins: text("trustedOrigins").array(),
	bookmarkedTemplates: text("bookmarkedTemplates")
		.array()
		.default(sql`ARRAY[]::text[]`),
});

export const usersRelations = relations(user, ({ one, many }) => ({
	account: one(account, {
		fields: [user.id],
		references: [account.userId],
	}),
	organizations: many(organization),
	workspaces: many(workspaces),
	apiKeys: many(apikey),
	backups: many(backups),
	schedules: many(schedules),
}));

const createSchema = createInsertSchema(user, {
	id: z.string().min(1),
	isRegistered: z.boolean().optional(),
}).omit({
	role: true,
	trustedOrigins: true,
	bookmarkedTemplates: true,
});

export const apiCreateUserInvitation = createSchema.pick({}).extend({
	email: z.string().email(),
});

export const apiRemoveUser = createSchema
	.pick({
		id: true,
	})
	.required();

export const apiFindOneToken = createSchema
	.pick({})
	.required()
	.extend({
		token: z.string().min(1),
	});

export const apiAssignPermissions = createSchema
	.pick({
		id: true,
	})
	.extend({
		accessedWorkspaces: z.array(z.string()).optional(),
		accessedEnvironments: z.array(z.string()).optional(),
		accessedServices: z.array(z.string()).optional(),
		accessedGitProviders: z.array(z.string()).optional(),
		accessedRuntimeWorkers: z.array(z.string()).optional(),
	})
	.required();

export const apiFindOneUser = createSchema
	.pick({
		id: true,
	})
	.required();

export const apiFindOneUserByAuth = createSchema
	.pick({
		// authId: true,
	})
	.required();

export const apiTraefikConfig = z.object({
	traefikConfig: z.string().min(1),
});

export const apiModifyTraefikConfig = z.object({
	path: z.string().min(1),
	traefikConfig: z.string().min(1),
	runtimeWorkerId: z.string().optional(),
	// YAML validation runs by default; a bad Traefik file can take down all
	// ingress. Power users can opt out with `skipValidation: true`.
	skipValidation: z.boolean().optional(),
});
export const apiReadTraefikConfig = z.object({
	path: z
		.string()
		.min(1)
		.refine(
			(path) => {
				// Prevent directory traversal attacks
				if (path.includes("../") || path.includes("..\\")) {
					return false;
				}

				const { MAIN_TRAEFIK_PATH } = paths();
				if (path.startsWith("/") && !path.startsWith(MAIN_TRAEFIK_PATH)) {
					return false;
				}
				// Prevent null bytes and other dangerous characters
				if (path.includes("\0") || path.includes("\x00")) {
					return false;
				}
				return true;
			},
			{
				message:
					"Invalid path: path traversal or unauthorized directory access detected",
			},
		),
	runtimeWorkerId: z.string().optional(),
});

export const apiEnableDashboard = z.object({
	enableDashboard: z.boolean().optional(),
	runtimeWorkerId: z.string().optional(),
});

export const apiRuntimeWorkerSchema = z
	.object({
		runtimeWorkerId: z.string().optional(),
	})
	.optional();

export const apiReadStatsLogs = z.object({
	page: z
		.object({
			pageIndex: z.number(),
			pageSize: z.number(),
		})
		.optional(),
	status: z.string().array().optional(),
	search: z.string().optional(),
	sort: z.object({ id: z.string(), desc: z.boolean() }).optional(),
	dateRange: z
		.object({
			start: z.string().optional(),
			end: z.string().optional(),
		})
		.optional(),
});

export const apiUpdateUser = createSchema.partial().extend({
	email: z
		.string()
		.email("Please enter a valid email address")
		.min(1, "Email is required")
		.optional(),
	password: z.string().optional(),
	currentPassword: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
});
