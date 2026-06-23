import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";
import { applications } from "./application";
import { certificates } from "./certificate";
import { compose } from "./compose";
import { database } from "./database";
import { deployments } from "./deployment";
import { schedules } from "./schedule";
import { sshKeys } from "./ssh-key";
import { generateAppName } from "./utils";

export const runtimeWorkerStatus = pgEnum("runtimeWorkerStatus", [
	"active",
	"inactive",
]);
export const runtimeWorkerType = pgEnum("runtimeWorkerType", [
	"deploy",
	"build",
]);

export const runtimeWorkers = pgTable("runtimeWorker", {
	runtimeWorkerId: text("runtimeWorkerId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	description: text("description"),
	ipAddress: text("ipAddress").notNull(),
	port: integer("port").notNull(),
	username: text("username").notNull().default("root"),
	appName: text("appName")
		.notNull()
		.$defaultFn(() => generateAppName("runtime-worker")),
	enableDockerCleanup: boolean("enableDockerCleanup").notNull().default(false),
	buildsConcurrency: integer("buildsConcurrency").notNull().default(1),
	createdAt: text("createdAt").notNull(),
	organizationId: text("organizationId")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	runtimeWorkerStatus: runtimeWorkerStatus("runtimeWorkerStatus")
		.notNull()
		.default("active"),
	runtimeWorkerType: runtimeWorkerType("runtimeWorkerType")
		.notNull()
		.default("deploy"),
	command: text("command").notNull().default(""),
	sshKeyId: text("sshKeyId").references(() => sshKeys.sshKeyId, {
		onDelete: "set null",
	}),
	metricsConfig: jsonb("metricsConfig")
		.$type<{
			runtimeWorker: {
				type: "Docklands" | "Remote";
				refreshRate: number;
				port: number;
				token: string;
				urlCallback: string;
				retentionDays: number;
				cronJob: string;
				thresholds: {
					cpu: number;
					memory: number;
				};
			};
			containers: {
				refreshRate: number;
				services: {
					include: string[];
					exclude: string[];
				};
			};
		}>()
		.notNull()
		.default({
			runtimeWorker: {
				type: "Remote",
				refreshRate: 60,
				port: 4500,
				token: "",
				urlCallback: "",
				cronJob: "",
				retentionDays: 2,
				thresholds: {
					cpu: 0,
					memory: 0,
				},
			},
			containers: {
				refreshRate: 60,
				services: {
					include: [],
					exclude: [],
				},
			},
		}),
});

export const runtimeWorkerRelations = relations(
	runtimeWorkers,
	({ one, many }) => ({
		deployments: many(deployments, {
			relationName: "deploymentRuntimeWorker",
		}),
		buildDeployments: many(deployments, {
			relationName: "deploymentBuildRuntimeWorker",
		}),
		sshKey: one(sshKeys, {
			fields: [runtimeWorkers.sshKeyId],
			references: [sshKeys.sshKeyId],
		}),
		applications: many(applications, {
			relationName: "applicationRuntimeWorker",
		}),
		buildApplications: many(applications, {
			relationName: "applicationBuildRuntimeWorker",
		}),
		compose: many(compose),
		database: many(database),
		certificates: many(certificates),
		organization: one(organization, {
			fields: [runtimeWorkers.organizationId],
			references: [organization.id],
		}),
		schedules: many(schedules),
	}),
);

const createSchema = createInsertSchema(runtimeWorkers, {
	runtimeWorkerId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().nullish(),
	runtimeWorkerType: z.enum(["deploy", "build"]).optional(),
	sshKeyId: z.string().nullish(),
});

export const apiCreateRuntimeWorker = createSchema
	.pick({
		name: true,
		description: true,
		ipAddress: true,
		port: true,
		username: true,
		sshKeyId: true,
		runtimeWorkerType: true,
		enableDockerCleanup: true,
	})
	.required()
	.extend({
		enableDockerCleanup: z.boolean().default(true),
	});

export const apiFindOneRuntimeWorker = z.object({
	runtimeWorkerId: z.string().min(1),
});

export const apiRemoveRuntimeWorker = createSchema
	.pick({
		runtimeWorkerId: true,
	})
	.required();

export const apiUpdateRuntimeWorker = createSchema
	.pick({
		name: true,
		description: true,
		runtimeWorkerId: true,
		ipAddress: true,
		port: true,
		username: true,
		sshKeyId: true,
		runtimeWorkerType: true,
		enableDockerCleanup: true,
	})
	.required()
	.extend({
		command: z.string().optional(),
		enableDockerCleanup: z.boolean().default(true),
	});

export const apiUpdateRuntimeWorkerBuildsConcurrency = z.object({
	runtimeWorkerId: z.string().min(1),
	buildsConcurrency: z.number().int().min(1).max(100),
});

export const apiUpdateRuntimeWorkerMonitoring = createSchema
	.pick({
		runtimeWorkerId: true,
	})
	.required()
	.extend({
		metricsConfig: z
			.object({
				runtimeWorker: z.object({
					refreshRate: z.number().min(2),
					port: z.number().min(1),
					token: z.string(),
					urlCallback: z.string().url(),
					retentionDays: z.number().min(1),
					cronJob: z.string().min(1),
					thresholds: z.object({
						cpu: z.number().min(0),
						memory: z.number().min(0),
					}),
				}),
				containers: z.object({
					refreshRate: z.number().min(2),
					services: z.object({
						include: z.array(z.string()).optional(),
						exclude: z.array(z.string()).optional(),
					}),
				}),
			})
			.required(),
	});
