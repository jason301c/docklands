import { existsSync, promises as fsPromises } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";
import {
	and,
	asc,
	desc,
	eq,
	ilike,
	inArray,
	isNotNull,
	or,
	sql,
} from "drizzle-orm";
import { quote } from "shell-quote";
import type { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateDeployment,
	type apiCreateDeploymentBackup,
	type apiCreateDeploymentCompose,
	type apiCreateDeploymentPreview,
	type apiCreateDeploymentServer,
	type apiCreateDeploymentVolumeBackup,
	applications,
	compose,
	deployments,
	environments,
	workspaces,
} from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { removeDirectoryIfExistsContent } from "@/server/core/utils/filesystem/directory";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import { workspaceServicePath } from "@/shared/routes";
import {
	type Application,
	findApplicationById,
	updateApplicationStatus,
} from "./application";

const logger = createLogger("deployment");

import { findBackupById } from "./backup";
import { type Compose, findComposeById, updateCompose } from "./compose";
import {
	findPreviewDeploymentById,
	type PreviewDeployment,
	updatePreviewDeployment,
} from "./preview-deployment";
import { removeRollbackById } from "./rollbacks";
import { findRuntimeWorkerById, type RuntimeWorker } from "./runtime-worker";
import { findVolumeBackupById } from "./volume-backups";

export type ServicePath = { href: string | null; label: string };

export const getDeploymentErrorMessage = async ({
	logPath,
	runtimeWorkerId,
	fallback,
	maxLines = 50,
}: {
	logPath: string;
	runtimeWorkerId: string | null;
	fallback: string;
	maxLines?: number;
}): Promise<string> => {
	try {
		if (!logPath || logPath === ".") return fallback;
		const safeMaxLines =
			Number.isFinite(maxLines) && maxLines > 0
				? Math.min(Math.trunc(maxLines), 1000)
				: 50;

		let content = "";
		if (runtimeWorkerId) {
			const { stdout } = await execAsyncRemote(
				runtimeWorkerId,
				`tail -n ${safeMaxLines} ${quote([logPath])}`,
			);
			content = stdout;
		} else {
			if (!existsSync(logPath)) return fallback;
			const fileContent = await fsPromises.readFile(logPath, "utf-8");
			content = fileContent.trim().split("\n").slice(-safeMaxLines).join("\n");
		}

		const trimmed = content.trim();
		return trimmed.length > 0 ? trimmed : fallback;
	} catch (err) {
		logger.warn(
			{ err },
			"Could not read deployment log file, using fallback message",
		);
		return fallback;
	}
};

export async function resolveServicePath(
	orgId: string,
	data: Record<string, unknown>,
): Promise<ServicePath> {
	try {
		const applicationId = data?.applicationId as string | undefined;
		const composeId = data?.composeId as string | undefined;
		if (applicationId) {
			const app = await findApplicationById(applicationId);
			if (app.environment.workspace.organizationId !== orgId) {
				return { href: null, label: "Application" };
			}
			return {
				href: workspaceServicePath({
					workspaceId: app.environment.workspace.workspaceId,
					environmentId: app.environment.environmentId,
					serviceType: "application",
					serviceId: app.applicationId,
				}),
				label: "Application",
			};
		}
		if (composeId) {
			const comp = await findComposeById(composeId);
			if (comp.environment.workspace.organizationId !== orgId) {
				return { href: null, label: "Compose" };
			}
			return {
				href: workspaceServicePath({
					workspaceId: comp.environment.workspace.workspaceId,
					environmentId: comp.environment.environmentId,
					serviceType: "compose",
					serviceId: comp.composeId,
				}),
				label: "Compose",
			};
		}
	} catch {
		// not found or unauthorized
	}
	return { href: null, label: "—" };
}

export type Deployment = typeof deployments.$inferSelect;

export const findDeploymentById = async (deploymentId: string) => {
	return orThrowNotFound(
		db.query.deployments.findFirst({
			where: eq(deployments.deploymentId, deploymentId),
			with: {
				application: true,
			},
		}),
		"Deployment",
	);
};

/**
 * Resolve the service a deployment log belongs to, by its `logPath`. Used by the
 * build-log WebSocket to authorize per-service access (the socket runs outside
 * tRPC). Returns the owning ids, or null if no deployment matches the path.
 */
export const findDeploymentServiceByLogPath = async (logPath: string) => {
	const deployment = await db.query.deployments.findFirst({
		where: eq(deployments.logPath, logPath),
		columns: {
			applicationId: true,
			composeId: true,
			previewDeploymentId: true,
		},
		with: {
			previewDeployment: { columns: { applicationId: true } },
		},
	});
	if (!deployment) return null;
	return {
		applicationId:
			deployment.applicationId ??
			deployment.previewDeployment?.applicationId ??
			null,
		composeId: deployment.composeId ?? null,
	};
};

export const findDeploymentByApplicationId = async (applicationId: string) => {
	return orThrowNotFound(
		db.query.deployments.findFirst({
			where: eq(deployments.applicationId, applicationId),
		}),
		"Deployment",
	);
};

/**
 * The shared skeleton behind every `createDeployment*` adapter below: pick the
 * base log dir from whether a runtime worker is involved, build the timestamped
 * log path, initialize the log (remote `execAsyncRemote` vs. local
 * mkdir+writeFile), then insert a `running` deployment row — or, on failure,
 * insert an `error` row, optionally update the owning entity's status, and
 * rethrow a `BAD_REQUEST`.
 *
 * Only the parts that genuinely differ per kind are injected as callers' values:
 * the resolved `runtimeWorkerId`, the base path, the `appName`, the FK fields,
 * the per-kind init strings, and the divergent error-branch ordering (some kinds
 * log before the insert, some update entity status + log after, backup does
 * neither). This keeps each original's exact behavior — same log path, same
 * insert columns, same error handling, same return value.
 */
type DeploymentInsert = typeof deployments.$inferInsert;
type DeploymentRecordValues = Partial<DeploymentInsert>;

const createDeploymentRecord = async (params: {
	/** Runtime worker that owns the build/log, or null/undefined for local. */
	runtimeWorkerId: string | null | undefined;
	/** Base directory for the log file (LOGS_PATH / VOLUME_BACKUPS_PATH / …). */
	basePath: string;
	/** Service/app name used for the per-service log subdirectory. */
	appName: string;
	/** Exact remote init command, built from the resolved log path. */
	buildRemoteCommand: (ctx: {
		basePath: string;
		appName: string;
		logFilePath: string;
	}) => string;
	/** Exact content written when initializing the log locally. */
	localInitContent: string;
	/** Resolved `title` column (already defaulted by the caller). */
	title: string;
	/** Resolved `description` column (already defaulted by the caller). */
	description: string;
	/** FK + extra columns for the success (`running`) insert. */
	successValues: DeploymentRecordValues;
	/** FK columns for the error insert (errorMessage is added by the helper). */
	errorValues: DeploymentRecordValues;
	/** Message thrown via TRPCError BAD_REQUEST on any failure. */
	errorMessage: string;
	/** Optional log emitted *before* the error insert (schedule/volume-backup). */
	logErrorBeforeInsert?: (error: unknown) => void;
	/** Optional entity-status update run *after* the error insert. */
	onError?: () => Promise<void>;
	/** Optional log emitted *after* onError (application/preview/compose). */
	logErrorAfterOnError?: (error: unknown) => void;
}) => {
	const {
		runtimeWorkerId,
		basePath,
		appName,
		buildRemoteCommand,
		localInitContent,
		title,
		description,
		successValues,
		errorValues,
		errorMessage,
		logErrorBeforeInsert,
		onError,
		logErrorAfterOnError,
	} = params;
	try {
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(basePath, appName, fileName);

		if (runtimeWorkerId) {
			const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);
			const command = buildRemoteCommand({ basePath, appName, logFilePath });
			await execAsyncRemote(runtimeWorker.runtimeWorkerId, command);
		} else {
			await fsPromises.mkdir(path.join(basePath, appName), {
				recursive: true,
			});
			await fsPromises.writeFile(logFilePath, localInitContent);
		}

		const successInsert: DeploymentInsert = {
			title,
			description,
			status: "running",
			logPath: logFilePath,
			startedAt: new Date().toISOString(),
			...successValues,
		};
		const deploymentCreate = await db
			.insert(deployments)
			.values(successInsert)
			.returning();
		if (deploymentCreate.length === 0 || !deploymentCreate[0]) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: errorMessage,
			});
		}
		return deploymentCreate[0];
	} catch (error) {
		logErrorBeforeInsert?.(error);
		const errorInsert: DeploymentInsert = {
			title,
			description,
			status: "error",
			logPath: "",
			errorMessage: `An error have occurred: ${error instanceof Error ? error.message : error}`,
			startedAt: new Date().toISOString(),
			finishedAt: new Date().toISOString(),
			...errorValues,
		};
		await db.insert(deployments).values(errorInsert).returning();
		if (onError) await onError();
		logErrorAfterOnError?.(error);
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: errorMessage,
		});
	}
};

export const createDeployment = async (
	deployment: Omit<
		z.infer<typeof apiCreateDeployment>,
		"deploymentId" | "createdAt" | "status" | "logPath"
	>,
) => {
	const application = await findApplicationById(deployment.applicationId);
	await removeLastTenDeployments(
		deployment.applicationId,
		"application",
		application.runtimeWorkerId,
	);
	const runtimeWorkerId =
		application.buildRuntimeWorkerId || application.runtimeWorkerId;
	const { LOGS_PATH } = paths(!!runtimeWorkerId);
	const title = deployment.title || "Deployment";
	const description = deployment.description || "";
	return createDeploymentRecord({
		runtimeWorkerId,
		basePath: LOGS_PATH,
		appName: application.appName,
		buildRemoteCommand: ({ basePath, appName, logFilePath }) => `
				mkdir -p ${basePath}/${appName};
            	echo "Initializing deployment" >> ${logFilePath};
			    echo "Building on ${runtimeWorkerId ? "Build Server" : "Docklands Server"}" >> ${logFilePath};
			`,
		localInitContent: "Initializing deployment\n",
		title,
		description,
		successValues: {
			applicationId: deployment.applicationId,
			...(application.buildRuntimeWorkerId && {
				buildRuntimeWorkerId: application.buildRuntimeWorkerId,
			}),
		},
		errorValues: {
			applicationId: deployment.applicationId,
		},
		errorMessage: "Error creating the deployment",
		onError: async () => {
			await updateApplicationStatus(application.applicationId, "error");
		},
		logErrorAfterOnError: (error) =>
			logger.error(
				{ err: error, applicationId: deployment.applicationId },
				"Failed to create deployment",
			),
	});
};

export const createDeploymentPreview = async (
	deployment: Omit<
		z.infer<typeof apiCreateDeploymentPreview>,
		"deploymentId" | "createdAt" | "status" | "logPath"
	>,
) => {
	const previewDeployment = await findPreviewDeploymentById(
		deployment.previewDeploymentId,
	);
	await removeLastTenDeployments(
		deployment.previewDeploymentId,
		"previewDeployment",
		previewDeployment?.application?.runtimeWorkerId,
	);
	const runtimeWorkerId = previewDeployment?.application?.runtimeWorkerId;
	const { LOGS_PATH } = paths(!!runtimeWorkerId);
	const title = deployment.title || "Deployment";
	const description = deployment.description || "";
	return createDeploymentRecord({
		runtimeWorkerId,
		basePath: LOGS_PATH,
		appName: `${previewDeployment.appName}`,
		buildRemoteCommand: ({ basePath, appName, logFilePath }) => `
				mkdir -p ${basePath}/${appName};
            	echo "Initializing deployment" >> ${logFilePath};
			`,
		localInitContent: "Initializing deployment",
		title,
		description,
		successValues: {
			previewDeploymentId: deployment.previewDeploymentId,
		},
		errorValues: {
			previewDeploymentId: deployment.previewDeploymentId,
		},
		errorMessage: "Error creating the deployment",
		onError: async () => {
			await updatePreviewDeployment(deployment.previewDeploymentId, {
				previewStatus: "error",
			});
		},
		logErrorAfterOnError: (error) =>
			logger.error(
				{ err: error, previewDeploymentId: deployment.previewDeploymentId },
				"Failed to create preview deployment",
			),
	});
};

export const createDeploymentCompose = async (
	deployment: Omit<
		z.infer<typeof apiCreateDeploymentCompose>,
		"deploymentId" | "createdAt" | "status" | "logPath"
	>,
) => {
	const compose = await findComposeById(deployment.composeId);
	await removeLastTenDeployments(
		deployment.composeId,
		"compose",
		compose.runtimeWorkerId,
	);
	const { LOGS_PATH } = paths(!!compose.runtimeWorkerId);
	const title = deployment.title || "Deployment";
	const description = deployment.description || "";
	return createDeploymentRecord({
		runtimeWorkerId: compose.runtimeWorkerId,
		basePath: LOGS_PATH,
		appName: compose.appName,
		buildRemoteCommand: ({ basePath, appName, logFilePath }) => `
mkdir -p ${basePath}/${appName};
echo "Initializing deployment\n" >> ${logFilePath};
`,
		localInitContent: "Initializing deployment\n",
		title,
		description,
		successValues: {
			composeId: deployment.composeId,
		},
		errorValues: {
			composeId: deployment.composeId,
		},
		errorMessage: "Error creating the deployment",
		onError: async () => {
			await updateCompose(compose.composeId, {
				composeStatus: "error",
			});
		},
		logErrorAfterOnError: (error) =>
			logger.error(
				{ err: error, composeId: deployment.composeId },
				"Failed to create compose deployment",
			),
	});
};

export const createDeploymentBackup = async (
	deployment: Omit<
		z.infer<typeof apiCreateDeploymentBackup>,
		"deploymentId" | "createdAt" | "status" | "logPath"
	>,
) => {
	const backup = await findBackupById(deployment.backupId);

	let runtimeWorkerId: string | null | undefined;
	if (backup.backupType === "database") {
		runtimeWorkerId = backup.database?.runtimeWorkerId;
	} else if (backup.backupType === "compose") {
		runtimeWorkerId = backup.compose?.runtimeWorkerId;
	}
	await removeLastTenDeployments(
		deployment.backupId,
		"backup",
		runtimeWorkerId,
	);
	const { LOGS_PATH } = paths(!!runtimeWorkerId);
	const title = deployment.title || "Backup";
	const description = deployment.description || "";
	return createDeploymentRecord({
		runtimeWorkerId,
		basePath: LOGS_PATH,
		appName: backup.appName,
		buildRemoteCommand: ({ basePath, appName, logFilePath }) => `
mkdir -p ${basePath}/${appName};
echo "Initializing backup\n" >> ${logFilePath};
`,
		localInitContent: "Initializing backup\n",
		title,
		description,
		successValues: {
			backupId: deployment.backupId,
		},
		errorValues: {
			backupId: deployment.backupId,
		},
		errorMessage: "Error creating the backup",
	});
};

export const createDeploymentVolumeBackup = async (
	deployment: Omit<
		z.infer<typeof apiCreateDeploymentVolumeBackup>,
		"deploymentId" | "createdAt" | "status" | "logPath"
	>,
) => {
	const volumeBackup = await findVolumeBackupById(deployment.volumeBackupId);

	const runtimeWorkerId =
		volumeBackup.application?.runtimeWorkerId ||
		volumeBackup.compose?.runtimeWorkerId;
	await removeLastTenDeployments(
		deployment.volumeBackupId,
		"volumeBackup",
		runtimeWorkerId,
	);
	const { VOLUME_BACKUPS_PATH } = paths(!!runtimeWorkerId);
	const title = deployment.title || "Deployment";
	const description = deployment.description || "";
	return createDeploymentRecord({
		runtimeWorkerId,
		basePath: VOLUME_BACKUPS_PATH,
		appName: volumeBackup.appName,
		buildRemoteCommand: ({ basePath, appName, logFilePath }) => `
				mkdir -p ${basePath}/${appName};
            	echo "Initializing volume backup" >> ${logFilePath};
			`,
		localInitContent: "Initializing volume backup\n",
		title,
		description,
		successValues: {
			volumeBackupId: deployment.volumeBackupId,
		},
		errorValues: {
			volumeBackupId: deployment.volumeBackupId,
		},
		errorMessage: "Error creating the deployment",
		logErrorBeforeInsert: (error) =>
			logger.error(
				{ err: error, volumeBackupId: deployment.volumeBackupId },
				"Failed to create volume-backup deployment",
			),
	});
};

export const removeDeployment = async (deploymentId: string) => {
	try {
		const deployment = await db
			.delete(deployments)
			.where(eq(deployments.deploymentId, deploymentId))
			.returning()
			.then((result) => result[0]);

		if (!deployment) {
			return null;
		}

		const logPath = path.join(deployment.logPath);
		if (logPath && logPath !== ".") {
			const command = `rm -f ${logPath};`;
			if (deployment.runtimeWorkerId) {
				await execAsyncRemote(deployment.runtimeWorkerId, command);
			} else {
				await execAsync(command);
			}
		}

		return deployment;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Error removing the deployment";
		throw new TRPCError({
			code: "BAD_REQUEST",
			message,
		});
	}
};

export const removeDeploymentsByApplicationId = async (
	applicationId: string,
) => {
	await db
		.delete(deployments)
		.where(eq(deployments.applicationId, applicationId))
		.returning();
};

const getDeploymentsByType = async (
	id: string,
	type:
		| "application"
		| "compose"
		| "runtimeWorker"
		| "previewDeployment"
		| "backup"
		| "volumeBackup",
) => {
	const deploymentList = await db.query.deployments.findMany({
		where: eq(deployments[`${type}Id`], id),
		orderBy: desc(deployments.createdAt),
		with: {
			rollback: true,
		},
	});
	return deploymentList;
};

export const removeDeployments = async (application: Application) => {
	const { appName, applicationId } = application;
	const { LOGS_PATH } = paths(!!application.runtimeWorkerId);
	const logsPath = path.join(LOGS_PATH, appName);
	if (application.runtimeWorkerId) {
		await execAsyncRemote(application.runtimeWorkerId, `rm -rf ${logsPath}`);
	} else {
		await removeDirectoryIfExistsContent(logsPath);
	}
	await removeDeploymentsByApplicationId(applicationId);
};

const removeLastTenDeployments = async (
	id: string,
	type:
		| "application"
		| "compose"
		| "runtimeWorker"
		| "previewDeployment"
		| "backup"
		| "volumeBackup",
	runtimeWorkerId?: string | null,
) => {
	const deploymentList = await getDeploymentsByType(id, type);
	if (deploymentList.length > 10) {
		const deploymentsToDelete = deploymentList.slice(10);
		logger.debug(
			{ count: deploymentsToDelete.length, id, type },
			"Removing old deployments",
		);
		if (runtimeWorkerId) {
			let command = "";
			for (const oldDeployment of deploymentsToDelete) {
				try {
					const logPath = path.join(oldDeployment.logPath);
					if (oldDeployment.rollbackId) {
						await removeRollbackById(oldDeployment.rollbackId);
					}

					if (logPath && logPath !== ".") {
						command += `rm -rf ${logPath};`;
					}
					await removeDeployment(oldDeployment.deploymentId);
				} catch (err) {
					logger.warn(
						{ err, deploymentId: oldDeployment.deploymentId },
						"Failed to remove old deployment during cleanup",
					);
				}
			}

			if (command) {
				await execAsyncRemote(runtimeWorkerId, command);
			}
		} else {
			for (const oldDeployment of deploymentsToDelete) {
				try {
					if (oldDeployment.rollbackId) {
						await removeRollbackById(oldDeployment.rollbackId);
					}
					const logPath = path.join(oldDeployment.logPath);
					if (
						logPath &&
						logPath !== "." &&
						existsSync(logPath) &&
						!oldDeployment.errorMessage
					) {
						await fsPromises.unlink(logPath);
					}
					await removeDeployment(oldDeployment.deploymentId);
				} catch (err) {
					logger.warn(
						{ err, deploymentId: oldDeployment.deploymentId },
						"Failed to remove old deployment during cleanup",
					);
				}
			}
		}
	}
};

export const removeDeploymentsByPreviewDeploymentId = async (
	previewDeployment: PreviewDeployment,
	runtimeWorkerId: string | null,
) => {
	const { appName } = previewDeployment;
	const { LOGS_PATH } = paths(!!runtimeWorkerId);
	const logsPath = path.join(LOGS_PATH, appName);
	if (runtimeWorkerId) {
		await execAsyncRemote(runtimeWorkerId, `rm -rf ${logsPath}`);
	} else {
		await removeDirectoryIfExistsContent(logsPath);
	}

	await db
		.delete(deployments)
		.where(
			eq(
				deployments.previewDeploymentId,
				previewDeployment.previewDeploymentId,
			),
		)
		.returning();
};

export const removeDeploymentsByComposeId = async (compose: Compose) => {
	const { appName } = compose;
	const { LOGS_PATH } = paths(!!compose.runtimeWorkerId);
	const logsPath = path.join(LOGS_PATH, appName);
	if (compose.runtimeWorkerId) {
		await execAsyncRemote(compose.runtimeWorkerId, `rm -rf ${logsPath}`);
	} else {
		await removeDirectoryIfExistsContent(logsPath);
	}

	await db
		.delete(deployments)
		.where(eq(deployments.composeId, compose.composeId))
		.returning();
};

export const findAllDeploymentsByApplicationId = async (
	applicationId: string,
) => {
	const deploymentsList = await db.query.deployments.findMany({
		where: eq(deployments.applicationId, applicationId),
		orderBy: desc(deployments.createdAt),
	});
	return deploymentsList;
};

const centralizedDeploymentsWith = {
	application: {
		columns: { applicationId: true, name: true, appName: true },
		with: {
			environment: {
				columns: { environmentId: true, name: true },
				with: {
					workspace: {
						columns: { workspaceId: true, name: true },
					},
				},
			},
			runtimeWorker: {
				columns: { runtimeWorkerId: true, name: true, runtimeWorkerType: true },
			},
			buildServer: {
				columns: { runtimeWorkerId: true, name: true, runtimeWorkerType: true },
			},
		},
	},
	compose: {
		columns: { composeId: true, name: true, appName: true },
		with: {
			environment: {
				columns: { environmentId: true, name: true },
				with: {
					workspace: {
						columns: { workspaceId: true, name: true },
					},
				},
			},
			runtimeWorker: {
				columns: { runtimeWorkerId: true, name: true, runtimeWorkerType: true },
			},
		},
	},
	runtimeWorker: {
		columns: { runtimeWorkerId: true, name: true, runtimeWorkerType: true },
	},
	buildServer: {
		columns: { runtimeWorkerId: true, name: true, runtimeWorkerType: true },
	},
} as const;

async function getApplicationIdsInOrg(
	orgId: string,
	accessedServices: string[] | null,
): Promise<string[]> {
	const rows = await db
		.select({ applicationId: applications.applicationId })
		.from(applications)
		.innerJoin(
			environments,
			eq(applications.environmentId, environments.environmentId),
		)
		.innerJoin(workspaces, eq(environments.workspaceId, workspaces.workspaceId))
		.where(
			accessedServices !== null
				? and(
						eq(workspaces.organizationId, orgId),
						inArray(applications.applicationId, accessedServices),
					)
				: eq(workspaces.organizationId, orgId),
		);
	return rows.map((r) => r.applicationId);
}

async function getComposeIdsInOrg(
	orgId: string,
	accessedServices: string[] | null,
): Promise<string[]> {
	const rows = await db
		.select({ composeId: compose.composeId })
		.from(compose)
		.innerJoin(
			environments,
			eq(compose.environmentId, environments.environmentId),
		)
		.innerJoin(workspaces, eq(environments.workspaceId, workspaces.workspaceId))
		.where(
			accessedServices !== null
				? and(
						eq(workspaces.organizationId, orgId),
						inArray(compose.composeId, accessedServices),
					)
				: eq(workspaces.organizationId, orgId),
		);
	return rows.map((r) => r.composeId);
}

/**
 * All deployments for applications and compose in the org.
 * Pass accessedServices for members (only those services), null for owner/admin.
 */
export const findAllDeploymentsCentralized = async (
	orgId: string,
	accessedServices: string[] | null,
) => {
	if (accessedServices !== null && accessedServices.length === 0) {
		return [];
	}

	const [appIds, compIds] = await Promise.all([
		getApplicationIdsInOrg(orgId, accessedServices),
		getComposeIdsInOrg(orgId, accessedServices),
	]);

	if (appIds.length === 0 && compIds.length === 0) {
		return [];
	}

	const conditions = [
		...(appIds.length > 0 ? [inArray(deployments.applicationId, appIds)] : []),
		...(compIds.length > 0 ? [inArray(deployments.composeId, compIds)] : []),
	];
	const whereClause =
		conditions.length === 0
			? sql`1 = 0`
			: conditions.length === 1
				? conditions[0]
				: or(...conditions);

	return db.query.deployments.findMany({
		where: whereClause,
		orderBy: desc(deployments.createdAt),
		with: centralizedDeploymentsWith,
	});
};

export type CentralizedDeploymentRow = Awaited<
	ReturnType<typeof findAllDeploymentsCentralized>
>[number];

export type DeploymentStatusFilter =
	| "all"
	| "running"
	| "done"
	| "error"
	| "cancelled";
export type DeploymentTypeFilter = "all" | "application" | "compose";
export type DeploymentSortField = "createdAt" | "status";

export interface FindDeploymentsCentralizedPagedParams {
	search?: string;
	status?: DeploymentStatusFilter;
	type?: DeploymentTypeFilter;
	sortBy?: DeploymentSortField;
	sortDir?: "asc" | "desc";
	limit: number;
	offset: number;
}

export interface DeploymentCentralizedCounts {
	active: number;
	successful: number;
	failed: number;
	total: number;
}

export interface DeploymentsCentralizedPage {
	rows: CentralizedDeploymentRow[];
	total: number;
	counts: DeploymentCentralizedCounts;
	latestCreatedAt: string | null;
}

const emptyDeploymentsPage = (): DeploymentsCentralizedPage => ({
	rows: [],
	total: 0,
	counts: { active: 0, successful: 0, failed: 0, total: 0 },
	latestCreatedAt: null,
});

async function searchAccessibleServiceIds(
	column: typeof applications.applicationId | typeof compose.composeId,
	table: typeof applications | typeof compose,
	environmentColumn:
		| typeof applications.environmentId
		| typeof compose.environmentId,
	ids: string[],
	pattern: string,
): Promise<string[]> {
	if (ids.length === 0) return [];
	const rows = await db
		.select({ id: column })
		.from(table)
		.innerJoin(environments, eq(environmentColumn, environments.environmentId))
		.innerJoin(workspaces, eq(environments.workspaceId, workspaces.workspaceId))
		.where(
			and(
				inArray(column, ids),
				or(
					ilike(table.name, pattern),
					ilike(environments.name, pattern),
					ilike(workspaces.name, pattern),
				),
			),
		);
	return rows.map((r) => r.id);
}

/**
 * Server-side paginated/filtered/sorted view of the centralized deployment
 * timeline. Unlike `findAllDeploymentsCentralized` (which returns every row for
 * the client to slice), this applies search/status/type filters, ordering, and
 * limit/offset in SQL so the page scales past a handful of services.
 *
 * `counts`/`latestCreatedAt` are computed over the full **accessible** set
 * (ignoring the active filters) so the summary cards stay stable totals and can
 * act as filter toggles; `total` reflects the filtered result for pagination.
 */
export const findDeploymentsCentralizedPaged = async (
	orgId: string,
	accessedServices: string[] | null,
	params: FindDeploymentsCentralizedPagedParams,
): Promise<DeploymentsCentralizedPage> => {
	if (accessedServices !== null && accessedServices.length === 0) {
		return emptyDeploymentsPage();
	}

	const [appIds, compIds] = await Promise.all([
		getApplicationIdsInOrg(orgId, accessedServices),
		getComposeIdsInOrg(orgId, accessedServices),
	]);

	if (appIds.length === 0 && compIds.length === 0) {
		return emptyDeploymentsPage();
	}

	const accessibleConditions = [
		...(appIds.length > 0 ? [inArray(deployments.applicationId, appIds)] : []),
		...(compIds.length > 0 ? [inArray(deployments.composeId, compIds)] : []),
	];
	const accessibleWhere =
		accessibleConditions.length === 1
			? accessibleConditions[0]
			: or(...accessibleConditions);

	// Counts + latest over the full accessible set (filters not applied).
	const [statusCountRows, latestRows] = await Promise.all([
		db
			.select({
				status: deployments.status,
				count: sql<number>`count(*)::int`,
			})
			.from(deployments)
			.where(accessibleWhere)
			.groupBy(deployments.status),
		db
			.select({ latest: sql<string | null>`max(${deployments.createdAt})` })
			.from(deployments)
			.where(accessibleWhere),
	]);

	const counts: DeploymentCentralizedCounts = {
		active: 0,
		successful: 0,
		failed: 0,
		total: 0,
	};
	for (const row of statusCountRows) {
		counts.total += row.count;
		if (row.status === "running") counts.active += row.count;
		else if (row.status === "done") counts.successful += row.count;
		else if (row.status === "error") counts.failed += row.count;
	}
	const latestCreatedAt = latestRows[0]?.latest ?? null;

	// Filtered where for the visible page.
	const filterConditions = [accessibleWhere];
	if (params.status && params.status !== "all") {
		filterConditions.push(eq(deployments.status, params.status));
	}
	if (params.type === "application") {
		filterConditions.push(isNotNull(deployments.applicationId));
	} else if (params.type === "compose") {
		filterConditions.push(isNotNull(deployments.composeId));
	}

	const search = params.search?.trim();
	if (search) {
		const pattern = `%${search}%`;
		const [matchedAppIds, matchedCompIds] = await Promise.all([
			searchAccessibleServiceIds(
				applications.applicationId,
				applications,
				applications.environmentId,
				appIds,
				pattern,
			),
			searchAccessibleServiceIds(
				compose.composeId,
				compose,
				compose.environmentId,
				compIds,
				pattern,
			),
		]);
		const searchConditions = [
			...(matchedAppIds.length > 0
				? [inArray(deployments.applicationId, matchedAppIds)]
				: []),
			...(matchedCompIds.length > 0
				? [inArray(deployments.composeId, matchedCompIds)]
				: []),
			ilike(deployments.title, pattern),
		];
		filterConditions.push(or(...searchConditions));
	}

	const filteredWhere = and(...filterConditions);

	const direction = params.sortDir === "asc" ? asc : desc;
	const sortColumn =
		params.sortBy === "status" ? deployments.status : deployments.createdAt;
	const orderBy =
		params.sortBy === "status"
			? [direction(deployments.status), desc(deployments.createdAt)]
			: [direction(sortColumn)];

	const [total, rows] = await Promise.all([
		db.$count(deployments, filteredWhere),
		db.query.deployments.findMany({
			where: filteredWhere,
			orderBy,
			limit: params.limit,
			offset: params.offset,
			with: centralizedDeploymentsWith,
		}),
	]);

	return { rows, total, counts, latestCreatedAt };
};

export const updateDeployment = async (
	deploymentId: string,
	deploymentData: Partial<Deployment>,
) => {
	const application = await db
		.update(deployments)
		.set({
			...deploymentData,
		})
		.where(eq(deployments.deploymentId, deploymentId))
		.returning();

	return application;
};

export const updateDeploymentStatus = async (
	deploymentId: string,
	deploymentStatus: Deployment["status"],
) => {
	const application = await db
		.update(deployments)
		.set({
			status: deploymentStatus,
			finishedAt:
				deploymentStatus === "done" || deploymentStatus === "error"
					? new Date().toISOString()
					: null,
		})
		.where(eq(deployments.deploymentId, deploymentId))
		.returning();

	return application;
};

export const createServerDeployment = async (
	deployment: Omit<
		z.infer<typeof apiCreateDeploymentServer>,
		"deploymentId" | "createdAt" | "status" | "logPath"
	>,
) => {
	try {
		const { LOGS_PATH } = paths();

		const runtimeWorker = await findRuntimeWorkerById(
			deployment.runtimeWorkerId,
		);
		await removeLastFiveDeployments(deployment.runtimeWorkerId);
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${runtimeWorker.appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(LOGS_PATH, runtimeWorker.appName, fileName);
		await fsPromises.mkdir(path.join(LOGS_PATH, runtimeWorker.appName), {
			recursive: true,
		});
		await fsPromises.writeFile(logFilePath, "Initializing Setup Server");
		const deploymentCreate = await db
			.insert(deployments)
			.values({
				runtimeWorkerId: runtimeWorker.runtimeWorkerId,
				title: deployment.title || "Deployment",
				description: deployment.description || "",
				status: "running",
				logPath: logFilePath,
			})
			.returning();
		if (deploymentCreate.length === 0 || !deploymentCreate[0]) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the deployment",
			});
		}
		return deploymentCreate[0];
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Error creating the deployment";
		throw new TRPCError({
			code: "BAD_REQUEST",
			message,
		});
	}
};

export const removeLastFiveDeployments = async (runtimeWorkerId: string) => {
	const deploymentList = await db.query.deployments.findMany({
		where: eq(deployments.runtimeWorkerId, runtimeWorkerId),
		orderBy: desc(deployments.createdAt),
	});
	if (deploymentList.length >= 5) {
		const deploymentsToDelete = deploymentList.slice(4);
		for (const oldDeployment of deploymentsToDelete) {
			const logPath = path.join(oldDeployment.logPath);
			if (existsSync(logPath)) {
				await fsPromises.unlink(logPath);
			}
			await removeDeployment(oldDeployment.deploymentId);
		}
	}
};

export const removeDeploymentsByRuntimeWorkerId = async (
	runtimeWorker: RuntimeWorker,
) => {
	const { LOGS_PATH } = paths();
	const { appName } = runtimeWorker;
	const logsPath = path.join(LOGS_PATH, appName);
	await removeDirectoryIfExistsContent(logsPath);
	await db
		.delete(deployments)
		.where(eq(deployments.runtimeWorkerId, runtimeWorker.runtimeWorkerId))
		.returning();
};

export const clearOldDeployments = async (
	appName: string,
	runtimeWorkerId: string | null,
) => {
	const { LOGS_PATH } = paths(!!runtimeWorkerId);
	const folder = path.join(LOGS_PATH, appName);
	const command = `
		rm -rf ${folder};
	`;
	if (runtimeWorkerId) {
		await execAsyncRemote(runtimeWorkerId, command);
	} else {
		await execAsync(command);
	}
};
