import path from "node:path";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateMount,
	mounts,
	type ServiceType,
} from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import {
	createFile,
	getCreateFileCommand,
	getDeleteFileCommand,
	resolveFileMountPath,
} from "@/server/core/utils/docker/utils";
import { removeFileOrDirectory } from "@/server/core/utils/filesystem/directory";
import { execAsyncRemote } from "@/server/core/utils/process/execAsync";

export type Mount = typeof mounts.$inferSelect;

const logger = createLogger("mount");

const MANAGED_DATABASE_SERVICE_TYPES = new Set<ServiceType>([
	"postgres",
	"mysql",
	"mariadb",
	"mongo",
	"redis",
	"libsql",
]);

const isManagedDatabaseServiceType = (serviceType: ServiceType) =>
	MANAGED_DATABASE_SERVICE_TYPES.has(serviceType);

export const createMount = async (input: z.infer<typeof apiCreateMount>) => {
	try {
		const { serviceId, ...rest } = input;
		const value = await db
			.insert(mounts)
			.values({
				...rest,
				...(input.serviceType === "application" && {
					applicationId: serviceId,
				}),
				...(input.serviceType === "compose" && {
					composeId: serviceId,
				}),
				// All six managed engines live in the unified `database` table and
				// link via `databaseId` (the per-engine *Id columns were removed).
				...(isManagedDatabaseServiceType(input.serviceType) && {
					databaseId: serviceId,
				}),
			})
			.returning()
			.then((value) => value[0]);

		if (!value) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error inserting mount",
			});
		}

		if (value.type === "file") {
			await createFileMount(value.mountId);
		}
		return value;
	} catch (error) {
		logger.error({ err: error }, "createMount failed");
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

/**
 * Create a mount for the unified managed-database table. Links via `databaseId`
 * directly rather than the per-engine `serviceType` switch in `createMount`.
 */
export const createDatabaseMount = async (
	databaseId: string,
	input: {
		type: Mount["type"];
		mountPath: string;
		volumeName?: string | null;
		hostPath?: string | null;
		filePath?: string | null;
		content?: string | null;
	},
) => {
	const value = await db
		.insert(mounts)
		.values({
			...input,
			databaseId,
		})
		.returning()
		.then((rows) => rows[0]);

	if (!value) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error inserting database mount",
		});
	}

	if (value.type === "file") {
		await createFileMount(value.mountId);
	}
	return value;
};

export const createFileMount = async (mountId: string) => {
	try {
		const mount = await findMountById(mountId);
		const baseFilePath = await getBaseFilesPath(mountId);

		const runtimeWorkerId = await getServerId(mount);

		if (runtimeWorkerId) {
			const command = getCreateFileCommand(
				baseFilePath,
				mount.filePath || "",
				mount.content || "",
			);
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await createFile(baseFilePath, mount.filePath || "", mount.content || "");
		}
	} catch (error) {
		logger.error({ err: error, mountId }, "createFileMount failed");
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error creating the mount ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const findMountById = async (mountId: string) => {
	return orThrowNotFound(
		db.query.mounts.findFirst({
			where: eq(mounts.mountId, mountId),
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
				compose: {
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
			},
		}),
		"Mount",
	);
};

export const findMountOrganizationId = async (mountId: string) => {
	const mount = await findMountById(mountId);

	if (mount.application) {
		return mount.application.environment.workspace.organizationId;
	}
	if (mount.compose) {
		return mount.compose.environment.workspace.organizationId;
	}
	if (mount.database) {
		return mount.database.environment.workspace.organizationId;
	}

	return null;
};

export const updateMount = async (
	mountId: string,
	mountData: Partial<Mount>,
) => {
	const mount = await db.transaction(async (tx) => {
		const mount = await tx
			.update(mounts)
			.set({
				...mountData,
			})
			.where(eq(mounts.mountId, mountId))
			.returning()
			.then((value) => value[0]);

		if (!mount) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Mount not found",
			});
		}

		return await findMountById(mountId);
	});

	if (mount.type === "file") {
		await updateFileMount(mountId);
	}
	return mount;
};

export const deleteMount = async (mountId: string) => {
	const { type } = await findMountById(mountId);

	if (type === "file") {
		await deleteFileMount(mountId);
	}

	const deletedMount = await db
		.delete(mounts)
		.where(eq(mounts.mountId, mountId))
		.returning();
	return deletedMount[0];
};

export const updateFileMount = async (mountId: string) => {
	const mount = await findMountById(mountId);
	if (!mount?.filePath) return;
	const basePath = await getBaseFilesPath(mountId);

	try {
		const runtimeWorkerId = await getServerId(mount);
		if (runtimeWorkerId) {
			const command = getCreateFileCommand(
				basePath,
				mount.filePath,
				mount.content || "",
			);
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await createFile(basePath, mount.filePath, mount.content || "");
		}
	} catch (e) {
		logger.error({ err: e, mountId }, "updateFileMount failed");
	}
};

export const deleteFileMount = async (mountId: string) => {
	const mount = await findMountById(mountId);
	if (!mount.filePath) return;
	const basePath = await getBaseFilesPath(mountId);

	const fullPath = resolveFileMountPath(basePath, mount.filePath);
	try {
		const runtimeWorkerId = await getServerId(mount);
		if (runtimeWorkerId) {
			const command = getDeleteFileCommand(basePath, mount.filePath);
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await removeFileOrDirectory(fullPath);
		}
	} catch (e) {
		logger.warn(
			{ err: e, mountId, fullPath },
			"deleteFileMount filesystem cleanup failed",
		);
	}
};

export const getBaseFilesPath = async (mountId: string) => {
	const mount = await findMountById(mountId);

	let absoluteBasePath = "";
	let appName = "";
	let directoryPath = "";

	if (mount.serviceType === "application" && mount.application) {
		const { APPLICATIONS_PATH } = paths(!!mount.application.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.application.appName;
	} else if (mount.serviceType === "compose" && mount.compose) {
		const { COMPOSE_PATH } = paths(!!mount.compose.runtimeWorkerId);
		appName = mount.compose.appName;
		absoluteBasePath = path.resolve(COMPOSE_PATH);
	} else if (mount.database) {
		// all managed database engines
		const { APPLICATIONS_PATH } = paths(!!mount.database.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.database.appName;
	}
	directoryPath = path.join(absoluteBasePath, appName, "files");

	return directoryPath;
};

type MountNested = Awaited<ReturnType<typeof findMountById>>;
export const getServerId = async (mount: MountNested) => {
	if (
		mount.serviceType === "application" &&
		mount?.application?.runtimeWorkerId
	) {
		return mount.application.runtimeWorkerId;
	}
	if (mount.serviceType === "compose" && mount?.compose?.runtimeWorkerId) {
		return mount.compose.runtimeWorkerId;
	}
	if (mount?.database?.runtimeWorkerId) {
		return mount.database.runtimeWorkerId;
	}

	return null;
};
