import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import { type apiCreateBackup, backups } from "@/server/core/db/schema";

export type Backup = typeof backups.$inferSelect;

export type BackupSchedule = Awaited<ReturnType<typeof findBackupById>>;
export type BackupScheduleList = Awaited<ReturnType<typeof findBackupsByDbId>>;
export const createBackup = async (input: z.infer<typeof apiCreateBackup>) => {
	const newBackup = await db
		.insert(backups)
		.values({ ...input } as typeof backups.$inferInsert)
		.returning()
		.then((value) => value[0]);

	if (!newBackup) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the Backup",
		});
	}

	return newBackup;
};

export const findBackupById = async (backupId: string) => {
	return orThrowNotFound(
		db.query.backups.findFirst({
			where: eq(backups.backupId, backupId),
			with: {
				database: true,
				destination: {
					columns: {
						accessKey: false,
						secretAccessKey: false,
					},
				},
				compose: true,
			},
		}),
		"Backup",
	);
};

export const updateBackupById = async (
	backupId: string,
	backupData: Partial<Backup>,
) => {
	const result = await db
		.update(backups)
		.set({
			...backupData,
		})
		.where(eq(backups.backupId, backupId))
		.returning();

	return result[0];
};

export const removeBackupById = async (backupId: string) => {
	const result = await db
		.delete(backups)
		.where(eq(backups.backupId, backupId))
		.returning();

	return result[0];
};

export const findBackupsByDbId = async (databaseId: string) => {
	const result = await db.query.backups.findMany({
		where: eq(backups.databaseId, databaseId),
		with: {
			database: true,
			destination: {
				columns: {
					accessKey: false,
					secretAccessKey: false,
				},
			},
		},
	});
	return result || [];
};

export const findBackupsByServiceDatabaseId = async (
	serviceDatabaseId: string,
) => {
	const result = await db.query.backups.findMany({
		where: eq(backups.serviceDatabaseId, serviceDatabaseId),
		with: {
			serviceDatabase: true,
			destination: {
				columns: {
					accessKey: false,
					secretAccessKey: false,
				},
			},
		},
	});
	return result || [];
};
