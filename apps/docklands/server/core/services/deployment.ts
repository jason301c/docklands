import { existsSync, promises as fsPromises } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { quote } from "shell-quote";
import type { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import { db } from "@/server/core/db";
import {
	type apiCreateDeployment,
	type apiCreateDeploymentBackup,
	type apiCreateDeploymentCompose,
	type apiCreateDeploymentPreview,
	type apiCreateDeploymentSchedule,
	type apiCreateDeploymentServer,
	type apiCreateDeploymentVolumeBackup,
	applications,
	compose,
	deployments,
	environments,
	workspaces,
} from "@/server/core/db/schema";
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
import { findBackupById } from "./backup";
import { type Compose, findComposeById, updateCompose } from "./compose";
import {
	findPreviewDeploymentById,
	type PreviewDeployment,
	updatePreviewDeployment,
} from "./preview-deployment";
import { removeRollbackById } from "./rollbacks";
import { findRuntimeWorkerById, type RuntimeWorker } from "./runtime-worker";
import { findScheduleById } from "./schedule";
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
	} catch {
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
	const deployment = await db.query.deployments.findFirst({
		where: eq(deployments.deploymentId, deploymentId),
		with: {
			application: true,
			schedule: true,
		},
	});
	if (!deployment) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Deployment not found",
		});
	}
	return deployment;
};

export const findDeploymentByApplicationId = async (applicationId: string) => {
	const deployment = await db.query.deployments.findFirst({
		where: eq(deployments.applicationId, applicationId),
	});

	if (!deployment) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Deployment not found",
		});
	}
	return deployment;
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
	try {
		const runtimeWorkerId =
			application.buildRuntimeWorkerId || application.runtimeWorkerId;

		const { LOGS_PATH } = paths(!!runtimeWorkerId);
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${application.appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(LOGS_PATH, application.appName, fileName);

		if (runtimeWorkerId) {
			const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);

			const command = `
				mkdir -p ${LOGS_PATH}/${application.appName};
            	echo "Initializing deployment" >> ${logFilePath};
			    echo "Building on ${runtimeWorkerId ? "Build Server" : "Docklands Server"}" >> ${logFilePath};
			`;

			await execAsyncRemote(runtimeWorker.runtimeWorkerId, command);
		} else {
			await fsPromises.mkdir(path.join(LOGS_PATH, application.appName), {
				recursive: true,
			});
			await fsPromises.writeFile(logFilePath, "Initializing deployment\n");
		}

		const deploymentCreate = await db
			.insert(deployments)
			.values({
				applicationId: deployment.applicationId,
				title: deployment.title || "Deployment",
				status: "running",
				logPath: logFilePath,
				description: deployment.description || "",
				startedAt: new Date().toISOString(),
				...(application.buildRuntimeWorkerId && {
					buildRuntimeWorkerId: application.buildRuntimeWorkerId,
				}),
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
		await db
			.insert(deployments)
			.values({
				applicationId: deployment.applicationId,
				title: deployment.title || "Deployment",
				status: "error",
				logPath: "",
				description: deployment.description || "",
				errorMessage: `An error have occurred: ${error instanceof Error ? error.message : error}`,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			.returning();
		await updateApplicationStatus(application.applicationId, "error");
		console.log(error);
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the deployment",
		});
	}
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
	try {
		const appName = `${previewDeployment.appName}`;
		const { LOGS_PATH } = paths(
			!!previewDeployment?.application?.runtimeWorkerId,
		);
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(LOGS_PATH, appName, fileName);

		if (previewDeployment?.application?.runtimeWorkerId) {
			const runtimeWorker = await findRuntimeWorkerById(
				previewDeployment?.application?.runtimeWorkerId,
			);

			const command = `
				mkdir -p ${LOGS_PATH}/${appName};
            	echo "Initializing deployment" >> ${logFilePath};
			`;

			await execAsyncRemote(runtimeWorker.runtimeWorkerId, command);
		} else {
			await fsPromises.mkdir(path.join(LOGS_PATH, appName), {
				recursive: true,
			});
			await fsPromises.writeFile(logFilePath, "Initializing deployment");
		}

		const deploymentCreate = await db
			.insert(deployments)
			.values({
				title: deployment.title || "Deployment",
				status: "running",
				logPath: logFilePath,
				description: deployment.description || "",
				previewDeploymentId: deployment.previewDeploymentId,
				startedAt: new Date().toISOString(),
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
		await db
			.insert(deployments)
			.values({
				previewDeploymentId: deployment.previewDeploymentId,
				title: deployment.title || "Deployment",
				status: "error",
				logPath: "",
				description: deployment.description || "",
				errorMessage: `An error have occurred: ${error instanceof Error ? error.message : error}`,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			.returning();
		await updatePreviewDeployment(deployment.previewDeploymentId, {
			previewStatus: "error",
		});
		console.log(error);
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the deployment",
		});
	}
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
	try {
		const { LOGS_PATH } = paths(!!compose.runtimeWorkerId);
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${compose.appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(LOGS_PATH, compose.appName, fileName);

		if (compose.runtimeWorkerId) {
			const runtimeWorker = await findRuntimeWorkerById(
				compose.runtimeWorkerId,
			);

			const command = `
mkdir -p ${LOGS_PATH}/${compose.appName};
echo "Initializing deployment\n" >> ${logFilePath};
`;

			await execAsyncRemote(runtimeWorker.runtimeWorkerId, command);
		} else {
			await fsPromises.mkdir(path.join(LOGS_PATH, compose.appName), {
				recursive: true,
			});
			await fsPromises.writeFile(logFilePath, "Initializing deployment\n");
		}

		const deploymentCreate = await db
			.insert(deployments)
			.values({
				composeId: deployment.composeId,
				title: deployment.title || "Deployment",
				description: deployment.description || "",
				status: "running",
				logPath: logFilePath,
				startedAt: new Date().toISOString(),
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
		await db
			.insert(deployments)
			.values({
				composeId: deployment.composeId,
				title: deployment.title || "Deployment",
				status: "error",
				logPath: "",
				description: deployment.description || "",
				errorMessage: `An error have occurred: ${error instanceof Error ? error.message : error}`,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			.returning();
		await updateCompose(compose.composeId, {
			composeStatus: "error",
		});
		console.log(error);
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the deployment",
		});
	}
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
		runtimeWorkerId =
			backup.postgres?.runtimeWorkerId ||
			backup.mariadb?.runtimeWorkerId ||
			backup.mysql?.runtimeWorkerId ||
			backup.mongo?.runtimeWorkerId;
	} else if (backup.backupType === "compose") {
		runtimeWorkerId = backup.compose?.runtimeWorkerId;
	}
	await removeLastTenDeployments(
		deployment.backupId,
		"backup",
		runtimeWorkerId,
	);
	try {
		const { LOGS_PATH } = paths(!!runtimeWorkerId);
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${backup.appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(LOGS_PATH, backup.appName, fileName);

		if (runtimeWorkerId) {
			const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);

			const command = `
mkdir -p ${LOGS_PATH}/${backup.appName};
echo "Initializing backup\n" >> ${logFilePath};
`;

			await execAsyncRemote(runtimeWorker.runtimeWorkerId, command);
		} else {
			await fsPromises.mkdir(path.join(LOGS_PATH, backup.appName), {
				recursive: true,
			});
			await fsPromises.writeFile(logFilePath, "Initializing backup\n");
		}

		const deploymentCreate = await db
			.insert(deployments)
			.values({
				backupId: deployment.backupId,
				title: deployment.title || "Backup",
				description: deployment.description || "",
				status: "running",
				logPath: logFilePath,
				startedAt: new Date().toISOString(),
			})
			.returning();
		if (deploymentCreate.length === 0 || !deploymentCreate[0]) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating the backup",
			});
		}
		return deploymentCreate[0];
	} catch (error) {
		await db
			.insert(deployments)
			.values({
				backupId: deployment.backupId,
				title: deployment.title || "Backup",
				status: "error",
				logPath: "",
				description: deployment.description || "",
				errorMessage: `An error have occurred: ${error instanceof Error ? error.message : error}`,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			.returning();
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the backup",
		});
	}
};

export const createDeploymentSchedule = async (
	deployment: Omit<
		z.infer<typeof apiCreateDeploymentSchedule>,
		"deploymentId" | "createdAt" | "status" | "logPath"
	>,
) => {
	const schedule = await findScheduleById(deployment.scheduleId);

	const runtimeWorkerId =
		schedule.application?.runtimeWorkerId ||
		schedule.compose?.runtimeWorkerId ||
		schedule.runtimeWorker?.runtimeWorkerId;
	await removeLastTenDeployments(
		deployment.scheduleId,
		"schedule",
		runtimeWorkerId,
	);
	try {
		const { SCHEDULES_PATH } = paths(!!runtimeWorkerId);
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${schedule.appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(SCHEDULES_PATH, schedule.appName, fileName);

		if (runtimeWorkerId) {
			const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);

			const command = `
				mkdir -p ${SCHEDULES_PATH}/${schedule.appName};
            	echo "Initializing schedule" >> ${logFilePath};
			`;

			await execAsyncRemote(runtimeWorker.runtimeWorkerId, command);
		} else {
			await fsPromises.mkdir(path.join(SCHEDULES_PATH, schedule.appName), {
				recursive: true,
			});
			await fsPromises.writeFile(logFilePath, "Initializing schedule\n");
		}

		const deploymentCreate = await db
			.insert(deployments)
			.values({
				scheduleId: deployment.scheduleId,
				title: deployment.title || "Deployment",
				status: "running",
				logPath: logFilePath,
				description: deployment.description || "",
				startedAt: new Date().toISOString(),
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
		console.log(error);
		await db
			.insert(deployments)
			.values({
				scheduleId: deployment.scheduleId,
				title: deployment.title || "Deployment",
				status: "error",
				logPath: "",
				description: deployment.description || "",
				errorMessage: `An error have occurred: ${error instanceof Error ? error.message : error}`,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			.returning();

		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the deployment",
		});
	}
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
	try {
		const { VOLUME_BACKUPS_PATH } = paths(!!runtimeWorkerId);
		const formattedDateTime = format(new Date(), "yyyy-MM-dd:HH:mm:ss");
		const fileName = `${volumeBackup.appName}-${formattedDateTime}.log`;
		const logFilePath = path.join(
			VOLUME_BACKUPS_PATH,
			volumeBackup.appName,
			fileName,
		);

		if (runtimeWorkerId) {
			const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);

			const command = `
				mkdir -p ${VOLUME_BACKUPS_PATH}/${volumeBackup.appName};
            	echo "Initializing volume backup" >> ${logFilePath};
			`;

			await execAsyncRemote(runtimeWorker.runtimeWorkerId, command);
		} else {
			await fsPromises.mkdir(
				path.join(VOLUME_BACKUPS_PATH, volumeBackup.appName),
				{
					recursive: true,
				},
			);
			await fsPromises.writeFile(logFilePath, "Initializing volume backup\n");
		}

		const deploymentCreate = await db
			.insert(deployments)
			.values({
				volumeBackupId: deployment.volumeBackupId,
				title: deployment.title || "Deployment",
				status: "running",
				logPath: logFilePath,
				description: deployment.description || "",
				startedAt: new Date().toISOString(),
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
		console.log(error);
		await db
			.insert(deployments)
			.values({
				volumeBackupId: deployment.volumeBackupId,
				title: deployment.title || "Deployment",
				status: "error",
				logPath: "",
				description: deployment.description || "",
				errorMessage: `An error have occurred: ${error instanceof Error ? error.message : error}`,
				startedAt: new Date().toISOString(),
				finishedAt: new Date().toISOString(),
			})
			.returning();

		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the deployment",
		});
	}
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
		| "schedule"
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
		| "schedule"
		| "previewDeployment"
		| "backup"
		| "volumeBackup",
	runtimeWorkerId?: string | null,
) => {
	const deploymentList = await getDeploymentsByType(id, type);
	if (deploymentList.length > 10) {
		const deploymentsToDelete = deploymentList.slice(10);
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
					console.error(
						`Failed to remove deployment ${oldDeployment.deploymentId} during cleanup:`,
						err,
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
					console.error(
						`Failed to remove deployment ${oldDeployment.deploymentId} during cleanup:`,
						err,
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

export const findAllDeploymentsByComposeId = async (composeId: string) => {
	const deploymentsList = await db.query.deployments.findMany({
		where: eq(deployments.composeId, composeId),
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

export const findAllDeploymentsByServerId = async (runtimeWorkerId: string) => {
	const deploymentsList = await db.query.deployments.findMany({
		where: eq(deployments.runtimeWorkerId, runtimeWorkerId),
		orderBy: desc(deployments.createdAt),
	});
	return deploymentsList;
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
