import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	integer,
	pgTable,
	text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { dockerNameField, s3PrefixField } from "@/shared/validation/shell-safe";
import { applications } from "./application";
import { compose } from "./compose";
import { database } from "./database";
import { deployments } from "./deployment";
import { destinations } from "./destination";
import { serviceType } from "./mount";
import { generateAppName } from "./utils";

const s3TarObjectKeyField = z
	.string()
	.min(1)
	.refine(
		(value) =>
			value
				.split("/")
				.every(
					(segment) =>
						segment.length > 0 &&
						segment !== "." &&
						segment !== ".." &&
						/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(segment),
				),
		"Only safe S3 object key segments are allowed",
	)
	.refine((value) => value.endsWith(".tar"), "Backup file must be a .tar");

export const volumeBackups = pgTable("volume_backup", {
	volumeBackupId: text("volumeBackupId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	volumeName: text("volumeName").notNull(),
	prefix: text("prefix").notNull(),
	serviceType: serviceType("serviceType").notNull().default("application"),
	appName: text("appName")
		.notNull()
		.$defaultFn(() => generateAppName("volumeBackup")),
	serviceName: text("serviceName"),
	turnOff: boolean("turnOff").notNull().default(false),
	cronExpression: text("cronExpression").notNull(),
	keepLatestCount: integer("keepLatestCount"),
	enabled: boolean("enabled"),
	applicationId: text("applicationId").references(
		() => applications.applicationId,
		{
			onDelete: "cascade",
		},
	),
	databaseId: text("databaseId").references(
		(): AnyPgColumn => database.databaseId,
		{ onDelete: "cascade" },
	),
	composeId: text("composeId").references(() => compose.composeId, {
		onDelete: "cascade",
	}),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	destinationId: text("destinationId")
		.notNull()
		.references(() => destinations.destinationId, { onDelete: "cascade" }),
});

export type VolumeBackup = typeof volumeBackups.$inferSelect;

export const volumeBackupsRelations = relations(
	volumeBackups,
	({ one, many }) => ({
		application: one(applications, {
			fields: [volumeBackups.applicationId],
			references: [applications.applicationId],
		}),
		database: one(database, {
			fields: [volumeBackups.databaseId],
			references: [database.databaseId],
		}),
		compose: one(compose, {
			fields: [volumeBackups.composeId],
			references: [compose.composeId],
		}),
		destination: one(destinations, {
			fields: [volumeBackups.destinationId],
			references: [destinations.destinationId],
		}),
		deployments: many(deployments),
	}),
);

export const createVolumeBackupSchema = createInsertSchema(volumeBackups)
	.omit({
		volumeBackupId: true,
	})
	// These get interpolated into docker/rclone backup commands — constrain them
	// to shell-safe charsets at the boundary (see shared/validation/shell-safe).
	.extend({
		volumeName: dockerNameField,
		serviceName: dockerNameField.nullish(),
		prefix: s3PrefixField,
	});

export const updateVolumeBackupSchema = createVolumeBackupSchema.extend({
	volumeBackupId: z.string().min(1),
});

export const apiFindOneVolumeBackup = z.object({
	volumeBackupId: z.string().min(1),
});

export const restoreVolumeBackupSchema = z.object({
	backupFileName: s3TarObjectKeyField,
	destinationId: z.string().min(1),
	volumeName: dockerNameField,
	id: z.string().min(1),
	serviceType: z.enum(["application", "compose"]),
	runtimeWorkerId: z.string().optional(),
});
