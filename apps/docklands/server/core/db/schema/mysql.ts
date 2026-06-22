import { relations } from "drizzle-orm";
import { bigint, integer, json, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { backups } from "./backups";
import { environments } from "./environment";
import { mounts } from "./mount";
import { runtimeWorkers } from "./runtime-worker";
import {
	applicationStatus,
	type EndpointSpecSwarm,
	EndpointSpecSwarmSchema,
	type HealthCheckSwarm,
	HealthCheckSwarmSchema,
	type LabelsSwarm,
	LabelsSwarmSchema,
	type NetworkSwarm,
	NetworkSwarmSchema,
	type PlacementSwarm,
	PlacementSwarmSchema,
	type RestartPolicySwarm,
	RestartPolicySwarmSchema,
	type ServiceModeSwarm,
	ServiceModeSwarmSchema,
	type UlimitsSwarm,
	UlimitsSwarmSchema,
	type UpdateConfigSwarm,
	UpdateConfigSwarmSchema,
} from "./shared";
import {
	APP_NAME_MESSAGE,
	APP_NAME_REGEX,
	DATABASE_PASSWORD_MESSAGE,
	DATABASE_PASSWORD_REGEX,
	generateAppName,
} from "./utils";

export const mysql = pgTable("mysql", {
	mysqlId: text("mysqlId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	appName: text("appName")
		.notNull()
		.$defaultFn(() => generateAppName("mysql"))
		.unique(),
	description: text("description"),
	databaseName: text("databaseName").notNull(),
	databaseUser: text("databaseUser").notNull(),
	databasePassword: text("databasePassword").notNull(),
	databaseRootPassword: text("rootPassword").notNull(),
	dockerImage: text("dockerImage").notNull(),
	command: text("command"),
	args: text("args").array(),
	env: text("env"),
	memoryReservation: text("memoryReservation"),
	memoryLimit: text("memoryLimit"),
	cpuReservation: text("cpuReservation"),
	cpuLimit: text("cpuLimit"),
	externalPort: integer("externalPort"),
	applicationStatus: applicationStatus("applicationStatus")
		.notNull()
		.default("idle"),
	healthCheckSwarm: json("healthCheckSwarm").$type<HealthCheckSwarm>(),
	restartPolicySwarm: json("restartPolicySwarm").$type<RestartPolicySwarm>(),
	placementSwarm: json("placementSwarm").$type<PlacementSwarm>(),
	updateConfigSwarm: json("updateConfigSwarm").$type<UpdateConfigSwarm>(),
	rollbackConfigSwarm: json("rollbackConfigSwarm").$type<UpdateConfigSwarm>(),
	modeSwarm: json("modeSwarm").$type<ServiceModeSwarm>(),
	labelsSwarm: json("labelsSwarm").$type<LabelsSwarm>(),
	networkSwarm: json("networkSwarm").$type<NetworkSwarm[]>(),
	stopGracePeriodSwarm: bigint("stopGracePeriodSwarm", { mode: "number" }),
	endpointSpecSwarm: json("endpointSpecSwarm").$type<EndpointSpecSwarm>(),
	ulimitsSwarm: json("ulimitsSwarm").$type<UlimitsSwarm>(),
	replicas: integer("replicas").default(1).notNull(),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),

	environmentId: text("environmentId")
		.notNull()
		.references(() => environments.environmentId, { onDelete: "cascade" }),
	runtimeWorkerId: text("runtimeWorkerId").references(
		() => runtimeWorkers.runtimeWorkerId,
		{
			onDelete: "cascade",
		},
	),
});

export const mysqlRelations = relations(mysql, ({ one, many }) => ({
	environment: one(environments, {
		fields: [mysql.environmentId],
		references: [environments.environmentId],
	}),
	backups: many(backups),
	mounts: many(mounts),
	runtimeWorker: one(runtimeWorkers, {
		fields: [mysql.runtimeWorkerId],
		references: [runtimeWorkers.runtimeWorkerId],
	}),
}));

const createSchema = createInsertSchema(mysql, {
	mysqlId: z.string(),
	appName: z
		.string()
		.min(1)
		.max(63)
		.regex(APP_NAME_REGEX, APP_NAME_MESSAGE)
		.optional(),
	createdAt: z.string(),
	name: z.string().min(1),
	databaseName: z.string().min(1),
	databaseUser: z.string().min(1),
	databasePassword: z.string().regex(DATABASE_PASSWORD_REGEX, {
		message: DATABASE_PASSWORD_MESSAGE,
	}),
	databaseRootPassword: z
		.string()
		.regex(DATABASE_PASSWORD_REGEX, {
			message: DATABASE_PASSWORD_MESSAGE,
		})
		.optional(),
	dockerImage: z.string().default("mysql:8"),
	command: z.string().nullish(),
	args: z.array(z.string()).nullish(),
	env: z.string().nullish(),
	memoryReservation: z.string().nullish(),
	memoryLimit: z.string().nullish(),
	cpuReservation: z.string().nullish(),
	cpuLimit: z.string().nullish(),
	applicationStatus: z.enum(["idle", "running", "done", "error"]),
	externalPort: z.number().nullish(),
	description: z.string().nullish(),
	runtimeWorkerId: z.string().nullish(),
	healthCheckSwarm: HealthCheckSwarmSchema.nullable(),
	restartPolicySwarm: RestartPolicySwarmSchema.nullable(),
	placementSwarm: PlacementSwarmSchema.nullable(),
	updateConfigSwarm: UpdateConfigSwarmSchema.nullable(),
	rollbackConfigSwarm: UpdateConfigSwarmSchema.nullable(),
	modeSwarm: ServiceModeSwarmSchema.nullable(),
	labelsSwarm: LabelsSwarmSchema.nullable(),
	networkSwarm: NetworkSwarmSchema.nullable(),
	stopGracePeriodSwarm: z.number().nullable(),
	endpointSpecSwarm: EndpointSpecSwarmSchema.nullable(),
	ulimitsSwarm: UlimitsSwarmSchema.nullable(),
});

export const apiCreateMySql = createSchema.pick({
	name: true,
	appName: true,
	dockerImage: true,
	environmentId: true,
	description: true,
	databaseName: true,
	databaseUser: true,
	databasePassword: true,
	databaseRootPassword: true,
	runtimeWorkerId: true,
});

export const apiFindOneMySql = z.object({
	mysqlId: z.string().min(1),
});

export const apiChangeMySqlStatus = createSchema
	.pick({
		mysqlId: true,
		applicationStatus: true,
	})
	.required();

export const apiSaveEnvironmentVariablesMySql = createSchema
	.pick({
		mysqlId: true,
		env: true,
	})
	.required();

export const apiSaveExternalPortMySql = createSchema
	.pick({
		mysqlId: true,
		externalPort: true,
	})
	.required();

export const apiResetMysql = createSchema
	.pick({
		mysqlId: true,
		appName: true,
	})
	.required();

export const apiDeployMySql = createSchema
	.pick({
		mysqlId: true,
	})
	.required();

export const apiUpdateMySql = createSchema
	.partial()
	.extend({
		mysqlId: z.string().min(1),
		dockerImage: z.string().optional(),
	})
	.omit({ runtimeWorkerId: true });

export const apiRebuildMysql = createSchema
	.pick({
		mysqlId: true,
	})
	.required();
