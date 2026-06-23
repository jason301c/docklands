import path from "node:path";
import { TRPCError } from "@trpc/server";
import { eq, type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import { db } from "@/server/core/db";
import {
	type apiCreateMount,
	mounts,
	type ServiceType,
} from "@/server/core/db/schema";
import {
	createFile,
	encodeBase64,
	getCreateFileCommand,
} from "@/server/core/utils/docker/utils";
import { removeFileOrDirectory } from "@/server/core/utils/filesystem/directory";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";

export type Mount = typeof mounts.$inferSelect;

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
				...(input.serviceType === "libsql" && {
					libsqlId: serviceId,
				}),
				...(input.serviceType === "mariadb" && {
					mariadbId: serviceId,
				}),
				...(input.serviceType === "mongo" && {
					mongoId: serviceId,
				}),
				...(input.serviceType === "mysql" && {
					mysqlId: serviceId,
				}),
				...(input.serviceType === "postgres" && {
					postgresId: serviceId,
				}),
				...(input.serviceType === "redis" && {
					redisId: serviceId,
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
		console.log(error);
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
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
		console.log(`Error creating the file mount: ${error}`);
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Error creating the mount ${error instanceof Error ? error.message : error}`,
			cause: error,
		});
	}
};

export const findMountById = async (mountId: string) => {
	const mount = await db.query.mounts.findFirst({
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
			libsql: {
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
			mysql: {
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
			redis: {
				with: {
					environment: {
						with: {
							workspace: true,
						},
					},
				},
			},
		},
	});
	if (!mount) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Mount not found",
		});
	}
	return mount;
};

export const findMountOrganizationId = async (mountId: string) => {
	const mount = await findMountById(mountId);

	if (mount.application) {
		return mount.application.environment.workspace.organizationId;
	}
	if (mount.compose) {
		return mount.compose.environment.workspace.organizationId;
	}
	if (mount.libsql) {
		return mount.libsql.environment.workspace.organizationId;
	}
	if (mount.mariadb) {
		return mount.mariadb.environment.workspace.organizationId;
	}
	if (mount.mongo) {
		return mount.mongo.environment.workspace.organizationId;
	}
	if (mount.mysql) {
		return mount.mysql.environment.workspace.organizationId;
	}
	if (mount.postgres) {
		return mount.postgres.environment.workspace.organizationId;
	}
	if (mount.redis) {
		return mount.redis.environment.workspace.organizationId;
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

export const findMountsByApplicationId = async (
	serviceId: string,
	serviceType: ServiceType,
) => {
	const sqlChunks: SQL[] = [];

	switch (serviceType) {
		case "application":
			sqlChunks.push(eq(mounts.applicationId, serviceId));
			break;
		case "libsql":
			sqlChunks.push(eq(mounts.libsqlId, serviceId));
			break;
		case "mariadb":
			sqlChunks.push(eq(mounts.mariadbId, serviceId));
			break;
		case "mongo":
			sqlChunks.push(eq(mounts.mongoId, serviceId));
			break;
		case "mysql":
			sqlChunks.push(eq(mounts.mysqlId, serviceId));
			break;
		case "postgres":
			sqlChunks.push(eq(mounts.postgresId, serviceId));
			break;
		case "redis":
			sqlChunks.push(eq(mounts.redisId, serviceId));
			break;
		case "compose":
			sqlChunks.push(eq(mounts.composeId, serviceId));
			break;
		default:
			throw new Error(`Unknown service type: ${serviceType}`);
	}
	const mount = await db.query.mounts.findMany({
		where: sql.join(sqlChunks, sql.raw(" ")),
	});

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
	const fullPath = path.join(basePath, mount.filePath);

	try {
		const runtimeWorkerId = await getServerId(mount);
		const encodedContent = encodeBase64(mount.content || "");
		const command = `echo "${encodedContent}" | base64 -d > ${fullPath}`;
		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	} catch {
		console.log("Error updating file mount");
	}
};

export const deleteFileMount = async (mountId: string) => {
	const mount = await findMountById(mountId);
	if (!mount.filePath) return;
	const basePath = await getBaseFilesPath(mountId);

	const fullPath = path.join(basePath, mount.filePath);
	try {
		const runtimeWorkerId = await getServerId(mount);
		if (runtimeWorkerId) {
			const command = `rm -rf ${fullPath}`;
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await removeFileOrDirectory(fullPath);
		}
	} catch {}
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
	} else if (mount.serviceType === "postgres" && mount.postgres) {
		const { APPLICATIONS_PATH } = paths(!!mount.postgres.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.postgres.appName;
	} else if (mount.serviceType === "mariadb" && mount.mariadb) {
		const { APPLICATIONS_PATH } = paths(!!mount.mariadb.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.mariadb.appName;
	} else if (mount.serviceType === "mongo" && mount.mongo) {
		const { APPLICATIONS_PATH } = paths(!!mount.mongo.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.mongo.appName;
	} else if (mount.serviceType === "mysql" && mount.mysql) {
		const { APPLICATIONS_PATH } = paths(!!mount.mysql.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.mysql.appName;
	} else if (mount.serviceType === "redis" && mount.redis) {
		const { APPLICATIONS_PATH } = paths(!!mount.redis.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.redis.appName;
	} else if (mount.serviceType === "compose" && mount.compose) {
		const { COMPOSE_PATH } = paths(!!mount.compose.runtimeWorkerId);
		appName = mount.compose.appName;
		absoluteBasePath = path.resolve(COMPOSE_PATH);
	} else if (mount.serviceType === "libsql" && mount.libsql) {
		const { APPLICATIONS_PATH } = paths(!!mount.libsql.runtimeWorkerId);
		absoluteBasePath = path.resolve(APPLICATIONS_PATH);
		appName = mount.libsql.appName;
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
	if (mount.serviceType === "postgres" && mount?.postgres?.runtimeWorkerId) {
		return mount.postgres.runtimeWorkerId;
	}
	if (mount.serviceType === "mariadb" && mount?.mariadb?.runtimeWorkerId) {
		return mount.mariadb.runtimeWorkerId;
	}
	if (mount.serviceType === "mongo" && mount?.mongo?.runtimeWorkerId) {
		return mount.mongo.runtimeWorkerId;
	}
	if (mount.serviceType === "mysql" && mount?.mysql?.runtimeWorkerId) {
		return mount.mysql.runtimeWorkerId;
	}
	if (mount.serviceType === "redis" && mount?.redis?.runtimeWorkerId) {
		return mount.redis.runtimeWorkerId;
	}
	if (mount.serviceType === "compose" && mount?.compose?.runtimeWorkerId) {
		return mount.compose.runtimeWorkerId;
	}
	if (mount.serviceType === "libsql" && mount?.libsql?.runtimeWorkerId) {
		return mount.libsql.runtimeWorkerId;
	}

	return null;
};
