import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db";
import {
	type createVolumeBackupSchema,
	type updateVolumeBackupSchema,
	volumeBackups,
} from "../db/schema";

export const findVolumeBackupById = async (volumeBackupId: string) => {
	const volumeBackup = await db.query.volumeBackups.findFirst({
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
			postgres: {
				with: {
					environment: {
						with: {
							workspace: true,
						},
					},
				},
			},
			mysql: {
				with: {
					environment: {
						with: {
							workspace: true,
						},
					},
				},
			},
			mariadb: {
				with: {
					environment: {
						with: {
							workspace: true,
						},
					},
				},
			},
			mongo: {
				with: {
					environment: {
						with: {
							workspace: true,
						},
					},
				},
			},
			redis: {
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
			libsql: {
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
	});

	if (!volumeBackup) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Volume backup not found",
		});
	}

	return volumeBackup;
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
