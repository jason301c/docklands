import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import { notifications } from "@/server/core/db/schema";
import {
	type NotificationType,
	notificationRegistry,
} from "@/server/core/services/notification-registry";

export type Notification = typeof notifications.$inferSelect;

/**
 * Generic two-step create shared by all 12 providers.
 *
 * Step 1 inserts the provider sub-table row (registry `subValues`), step 2
 * inserts the parent `notifications` row pointing at it. This reproduces the
 * original per-provider `create<Provider>Notification` exactly: same columns,
 * same defaults, same `serverThreshold` inclusion rule, same transaction
 * ordering, same `BAD_REQUEST` errors, and the same (discarded) transaction
 * return value.
 */
export const createNotification = async (
	type: NotificationType,
	input: any,
	organizationId: string,
) => {
	const descriptor = notificationRegistry[type];

	await db.transaction(async (tx) => {
		const newProvider = await tx
			.insert(descriptor.table)
			.values(descriptor.subValues(input))
			.returning()
			.then((value) => value[0]);

		if (!newProvider) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Error input: Inserting ${type}`,
			});
		}

		const notificationValues: Record<string, unknown> = {
			[descriptor.notificationFk]: (newProvider as Record<string, unknown>)[
				descriptor.idColumn
			],
			name: input.name,
			appDeploy: input.appDeploy,
			appBuildError: input.appBuildError,
			databaseBackup: input.databaseBackup,
			docklandsBackup: input.docklandsBackup,
			volumeBackup: input.volumeBackup,
			docklandsRestart: input.docklandsRestart,
			dockerCleanup: input.dockerCleanup,
			notificationType: type,
			organizationId: organizationId,
		};

		if (descriptor.includeServerThreshold) {
			notificationValues.serverThreshold = input.serverThreshold;
		}

		const newDestination = await tx
			.insert(notifications)
			.values(notificationValues as typeof notifications.$inferInsert)
			.returning()
			.then((value) => value[0]);

		if (!newDestination) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error input: Inserting notification",
			});
		}

		return newDestination;
	});
};

/**
 * Generic two-step update shared by all 12 providers.
 *
 * Step 1 updates the parent `notifications` row, step 2 updates the provider
 * sub-table row. Mirrors the original per-provider
 * `update<Provider>Notification`: same parent fields, same `serverThreshold`
 * rule, same transaction ordering, same error, same return value.
 */
export const updateNotification = async (
	type: NotificationType,
	input: any,
) => {
	const descriptor = notificationRegistry[type];

	await db.transaction(async (tx) => {
		const notificationValues: Record<string, unknown> = {
			name: input.name,
			appDeploy: input.appDeploy,
			appBuildError: input.appBuildError,
			databaseBackup: input.databaseBackup,
			docklandsBackup: input.docklandsBackup,
			volumeBackup: input.volumeBackup,
			docklandsRestart: input.docklandsRestart,
			dockerCleanup: input.dockerCleanup,
			organizationId: input.organizationId,
		};

		if (descriptor.includeServerThreshold) {
			notificationValues.serverThreshold = input.serverThreshold;
		}

		const newDestination = await tx
			.update(notifications)
			.set(notificationValues)
			.where(eq(notifications.notificationId, input.notificationId))
			.returning()
			.then((value) => value[0]);

		if (!newDestination) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error Updating notification",
			});
		}

		const idColumn = (descriptor.table as Record<string, any>)[
			descriptor.idColumn
		];

		await tx
			.update(descriptor.table)
			.set(descriptor.subValues(input))
			.where(eq(idColumn, input[descriptor.idColumn]));

		return newDestination;
	});
};

export const findNotificationById = async (notificationId: string) => {
	return orThrowNotFound(
		db.query.notifications.findFirst({
			where: eq(notifications.notificationId, notificationId),
			with: {
				slack: true,
				telegram: true,
				discord: true,
				email: true,
				resend: true,
				gotify: true,
				ntfy: true,
				mattermost: true,
				custom: true,
				lark: true,
				pushover: true,
				teams: true,
			},
		}),
		"Notification",
	);
};

export const removeNotificationById = async (notificationId: string) => {
	const result = await db
		.delete(notifications)
		.where(eq(notifications.notificationId, notificationId))
		.returning();

	return result[0];
};

export const updateNotificationById = async (
	notificationId: string,
	notificationData: Partial<Notification>,
) => {
	const result = await db
		.update(notifications)
		.set({
			...notificationData,
		})
		.where(eq(notifications.notificationId, notificationId))
		.returning();

	return result[0];
};
