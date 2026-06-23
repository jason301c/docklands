import { relations } from "drizzle-orm";
import {
	bigint,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
	DATABASE_ENGINE_KEYS,
	type DatabaseConfigByKey,
	type DatabaseEngineKey,
} from "@/server/core/databases/registry";
import { encryptedJson, encryptedText } from "../encrypted";
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
import { APP_NAME_MESSAGE, APP_NAME_REGEX, generateAppName } from "./utils";

/** Engine discriminator for the unified managed-database table. */
export const databaseEngine = pgEnum("databaseEngine", [
	...DATABASE_ENGINE_KEYS,
]);

/**
 * The unified managed-database table. Replaces the six per-engine tables
 * (postgres/mysql/mariadb/mongo/redis/libsql). All shared columns are real
 * columns; everything engine-specific (credentials + engine settings) lives in
 * the `config` jsonb, validated per-engine by the engine registry.
 */
export const database = pgTable(
	"database",
	{
		databaseId: text("databaseId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		engine: databaseEngine("engine").notNull(),
		name: text("name").notNull(),
		appName: text("appName")
			.notNull()
			.$defaultFn(() => generateAppName("database"))
			.unique(),
		description: text("description"),
		/**
		 * Engine-specific credentials + settings, validated by the registry.
		 * Encrypted at rest (stored as text) since it holds the database password;
		 * transparent to call sites, which still read/write a typed object.
		 */
		config:
			encryptedJson<DatabaseConfigByKey[DatabaseEngineKey]>("config").notNull(),
		dockerImage: text("dockerImage").notNull(),
		command: text("command"),
		args: text("args").array(),
		env: encryptedText("env"),
		memoryReservation: text("memoryReservation"),
		externalPort: integer("externalPort"),
		memoryLimit: text("memoryLimit"),
		cpuReservation: text("cpuReservation"),
		cpuLimit: text("cpuLimit"),
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
			{ onDelete: "cascade" },
		),
	},
	(t) => [
		index("database_environmentId_idx").on(t.environmentId),
		index("database_runtimeWorkerId_idx").on(t.runtimeWorkerId),
	],
);

export const databaseRelations = relations(database, ({ one, many }) => ({
	environment: one(environments, {
		fields: [database.environmentId],
		references: [environments.environmentId],
	}),
	backups: many(backups),
	mounts: many(mounts),
	runtimeWorker: one(runtimeWorkers, {
		fields: [database.runtimeWorkerId],
		references: [runtimeWorkers.runtimeWorkerId],
	}),
}));

const createSchema = createInsertSchema(database, {
	databaseId: z.string(),
	engine: z.enum(DATABASE_ENGINE_KEYS),
	name: z.string().min(1),
	appName: z
		.string()
		.min(1)
		.max(63)
		.regex(APP_NAME_REGEX, APP_NAME_MESSAGE)
		.optional(),
	// engine-specific config is validated by the registry in the service layer
	config: z.record(z.string(), z.unknown()),
	dockerImage: z.string(),
	command: z.string().nullish(),
	args: z.array(z.string()).nullish(),
	env: z.string().nullish(),
	memoryReservation: z.string().nullish(),
	memoryLimit: z.string().nullish(),
	cpuReservation: z.string().nullish(),
	cpuLimit: z.string().nullish(),
	environmentId: z.string(),
	applicationStatus: z.enum(["idle", "running", "done", "error"]),
	externalPort: z.number().nullish(),
	createdAt: z.string(),
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

export const apiCreateDatabase = createSchema
	.pick({
		engine: true,
		name: true,
		appName: true,
		dockerImage: true,
		command: true,
		args: true,
		env: true,
		environmentId: true,
		description: true,
		runtimeWorkerId: true,
		externalPort: true,
	})
	.extend({
		config: z.record(z.string(), z.unknown()),
	});

export const apiFindOneDatabase = z.object({
	databaseId: z.string().min(1),
});

export const apiSaveEnvironmentVariablesDatabase = z.object({
	databaseId: z.string().min(1),
	env: z.string().nullish(),
});

export const apiSaveExternalPortDatabase = z.object({
	databaseId: z.string().min(1),
	externalPort: z.number().nullish(),
});

export const apiDeployDatabase = apiFindOneDatabase;
export const apiResetDatabase = apiFindOneDatabase;
export const apiRebuildDatabase = apiFindOneDatabase;

export const apiUpdateDatabase = createSchema
	.partial()
	.extend({
		databaseId: z.string().min(1),
		dockerImage: z.string().optional(),
	})
	// engine-specific config is changed through dedicated mutations
	// (e.g. changePassword), never via a blind partial update.
	.omit({ runtimeWorkerId: true, config: true });
