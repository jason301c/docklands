import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db";
import { orThrowNotFound } from "../db/find-or-throw";
import {
	type createVolumeBackupSchema,
	type updateVolumeBackupSchema,
	volumeBackups,
} from "../db/schema";

export const findVolumeBackupById = async (volumeBackupId: string) => {
	return orThrowNotFound(
		db.query.volumeBackups.findFirst({
			where: eq(volumeBackups.volumeBackupId, volumeBackupId),
			with: {
				application: {
					with: {
						environment: {
							with: {
								workspace: true,
							},
						},
					},
				},
				database: {
					with: {
						environment: {
							with: {
								workspace: true,
							},
						},
					},
				},
				compose: {
					with: {
						environment: {
							with: {
								workspace: true,
							},
						},
					},
				},
				destination: {
					columns: {
						accessKey: false,
						secretAccessKey: false,
					},
				},
			},
		}),
		"Volume backup",
	);
};

export const createVolumeBackup = async (
	volumeBackup: z.infer<typeof createVolumeBackupSchema>,
) => {
	const newVolumeBackup = await db
		.insert(volumeBackups)
		.values(volumeBackup as typeof volumeBackups.$inferInsert)
		.returning()
		.then((e) => e[0]);

	return newVolumeBackup;
};

export const removeVolumeBackup = async (volumeBackupId: string) => {
	await db
		.delete(volumeBackups)
		.where(eq(volumeBackups.volumeBackupId, volumeBackupId));
};

export const updateVolumeBackup = async (
	volumeBackupId: string,
	volumeBackup: z.infer<typeof updateVolumeBackupSchema>,
) => {
	return await db
		.update(volumeBackups)
		.set(volumeBackup as Partial<typeof volumeBackups.$inferInsert>)
		.where(eq(volumeBackups.volumeBackupId, volumeBackupId))
		.returning()
		.then((e) => e[0]);
};
