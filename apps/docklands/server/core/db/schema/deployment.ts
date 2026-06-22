import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	pgEnum,
	pgTable,
	text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { applications } from "./application";
import { backups } from "./backups";
import { compose } from "./compose";
import { previewDeployments } from "./preview-deployments";
import { rollbacks } from "./rollbacks";
import { runtimeWorkers } from "./runtime-worker";
import { schedules } from "./schedule";
import { volumeBackups } from "./volume-backups";

export const deploymentStatus = pgEnum("deploymentStatus", [
	"running",
	"done",
	"error",
	"cancelled",
]);

export const deployments = pgTable("deployment", {
	deploymentId: text("deploymentId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	title: text("title").notNull(),
	description: text("description"),
	status: deploymentStatus("status").default("running"),
	logPath: text("logPath").notNull(),
	pid: text("pid"),
	applicationId: text("applicationId").references(
		() => applications.applicationId,
		{ onDelete: "cascade" },
	),
	composeId: text("composeId").references(() => compose.composeId, {
		onDelete: "cascade",
	}),
	runtimeWorkerId: text("runtimeWorkerId").references(
		() => runtimeWorkers.runtimeWorkerId,
		{
			onDelete: "cascade",
		},
	),
	isPreviewDeployment: boolean("isPreviewDeployment").default(false),
	previewDeploymentId: text("previewDeploymentId").references(
		(): AnyPgColumn => previewDeployments.previewDeploymentId,
		{ onDelete: "cascade" },
	),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	startedAt: text("startedAt"),
	finishedAt: text("finishedAt"),
	errorMessage: text("errorMessage"),
	scheduleId: text("scheduleId").references(
		(): AnyPgColumn => schedules.scheduleId,
		{ onDelete: "cascade" },
	),
	backupId: text("backupId").references((): AnyPgColumn => backups.backupId, {
		onDelete: "cascade",
	}),
	rollbackId: text("rollbackId").references(
		(): AnyPgColumn => rollbacks.rollbackId,
		{ onDelete: "cascade" },
	),
	volumeBackupId: text("volumeBackupId").references(
		(): AnyPgColumn => volumeBackups.volumeBackupId,
		{ onDelete: "cascade" },
	),
	buildRuntimeWorkerId: text("buildRuntimeWorkerId").references(
		() => runtimeWorkers.runtimeWorkerId,
		{
			onDelete: "cascade",
		},
	),
});

export const deploymentsRelations = relations(deployments, ({ one }) => ({
	application: one(applications, {
		fields: [deployments.applicationId],
		references: [applications.applicationId],
	}),
	compose: one(compose, {
		fields: [deployments.composeId],
		references: [compose.composeId],
	}),
	runtimeWorker: one(runtimeWorkers, {
		fields: [deployments.runtimeWorkerId],
		references: [runtimeWorkers.runtimeWorkerId],
		relationName: "deploymentRuntimeWorker",
	}),
	buildRuntimeWorker: one(runtimeWorkers, {
		fields: [deployments.buildRuntimeWorkerId],
		references: [runtimeWorkers.runtimeWorkerId],
		relationName: "deploymentBuildRuntimeWorker",
	}),
	previewDeployment: one(previewDeployments, {
		fields: [deployments.previewDeploymentId],
		references: [previewDeployments.previewDeploymentId],
	}),
	schedule: one(schedules, {
		fields: [deployments.scheduleId],
		references: [schedules.scheduleId],
	}),
	backup: one(backups, {
		fields: [deployments.backupId],
		references: [backups.backupId],
	}),
	rollback: one(rollbacks, {
		fields: [deployments.deploymentId],
		references: [rollbacks.deploymentId],
	}),
	volumeBackup: one(volumeBackups, {
		fields: [deployments.volumeBackupId],
		references: [volumeBackups.volumeBackupId],
	}),
}));

const schema = createInsertSchema(deployments, {
	title: z.string().min(1),
	status: z.string().default("running"),
	logPath: z.string().min(1),
	applicationId: z.string().nullish(),
	composeId: z.string().nullish(),
	description: z.string().nullish(),
	previewDeploymentId: z.string().nullish(),
	buildRuntimeWorkerId: z.string().nullish(),
});
export const apiCreateDeployment = schema
	.pick({
		title: true,
		status: true,
		logPath: true,
		applicationId: true,
		description: true,
		previewDeploymentId: true,
	})
	.extend({
		applicationId: z.string().min(1),
	});

export const apiCreateDeploymentPreview = schema
	.pick({
		title: true,
		status: true,
		logPath: true,
		description: true,
		previewDeploymentId: true,
	})
	.extend({
		previewDeploymentId: z.string().min(1),
	});

export const apiCreateDeploymentCompose = schema
	.pick({
		title: true,
		status: true,
		logPath: true,
		composeId: true,
		description: true,
	})
	.extend({
		composeId: z.string().min(1),
	});

export const apiCreateDeploymentBackup = schema
	.pick({
		title: true,
		status: true,
		logPath: true,
		backupId: true,
		description: true,
	})
	.extend({
		backupId: z.string().min(1),
	});

export const apiCreateDeploymentServer = schema
	.pick({
		title: true,
		status: true,
		logPath: true,
		runtimeWorkerId: true,
		description: true,
	})
	.extend({
		runtimeWorkerId: z.string().min(1),
	});

export const apiCreateDeploymentSchedule = schema
	.pick({
		title: true,
		status: true,
		logPath: true,
		description: true,
	})
	.extend({
		scheduleId: z.string().min(1),
	});

export const apiCreateDeploymentVolumeBackup = schema
	.pick({
		title: true,
		status: true,
		logPath: true,
		description: true,
	})
	.extend({
		volumeBackupId: z.string().min(1),
	});

export const apiFindAllByApplication = z.object({
	applicationId: z.string().min(1),
});

export const apiFindAllByCompose = z.object({
	composeId: z.string().min(1),
});

export const apiFindAllByRuntimeWorker = z.object({
	runtimeWorkerId: z.string().min(1),
});

export const apiFindAllByType = z.object({
	id: z.string().min(1),
	type: z.enum([
		"application",
		"compose",
		"runtimeWorker",
		"schedule",
		"previewDeployment",
		"backup",
		"volumeBackup",
	]),
});
