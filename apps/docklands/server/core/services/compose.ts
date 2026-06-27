import { join } from "node:path";
import { TRPCError } from "@trpc/server";
import { eq, getTableColumns } from "drizzle-orm";
import type { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateCompose,
	backups,
	buildAppName,
	cleanAppName,
	compose,
} from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { getBuildComposeCommand } from "@/server/core/utils/builders/compose";
import { randomizeSpecificationFile } from "@/server/core/utils/docker/compose";
import {
	cloneCompose,
	loadDockerCompose,
	loadDockerComposeRemote,
} from "@/server/core/utils/docker/domain";
import type { ComposeSpecification } from "@/server/core/utils/docker/types";
import { sendBuildErrorNotifications } from "@/server/core/utils/notifications/build-error";
import { sendBuildSuccessNotifications } from "@/server/core/utils/notifications/build-success";
import {
	ExecError,
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import { cloneBitbucketRepository } from "@/server/core/utils/providers/bitbucket";
import {
	cloneGitRepository,
	getGitCommitInfo,
} from "@/server/core/utils/providers/git";
import { cloneGiteaRepository } from "@/server/core/utils/providers/gitea";
import { cloneGithubRepository } from "@/server/core/utils/providers/github";
import { cloneGitlabRepository } from "@/server/core/utils/providers/gitlab";
import { getCreateComposeFileCommand } from "@/server/core/utils/providers/raw";
import { workspaceServicePath } from "@/shared/routes";
import { encodeBase64 } from "../utils/docker/utils";
import {
	createDeploymentCompose,
	getDeploymentErrorMessage,
	updateDeployment,
	updateDeploymentStatus,
} from "./deployment";
import { getInstanceUrl } from "./instance-url";
import { generateApplyPatchesCommand } from "./patch";
import { validUniqueServerAppName } from "./workspace";
import { refreshConnectionVariablesForDeploy } from "./workspace-graph";

export type Compose = typeof compose.$inferSelect;

const logger = createLogger("compose-service");

export const createCompose = async (
	input: z.infer<typeof apiCreateCompose>,
) => {
	const appName = buildAppName("compose", input.appName);

	const valid = await validUniqueServerAppName(appName);
	if (!valid) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Service with this 'AppName' already exists",
		});
	}

	const newDestination = await db
		.insert(compose)
		.values({
			...input,
			composeFile: input.composeFile || "",
			appName,
		})
		.returning()
		.then((value) => value[0]);

	if (!newDestination) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error input: Inserting compose",
		});
	}

	return newDestination;
};

export const createComposeByTemplate = async (
	input: typeof compose.$inferInsert,
) => {
	const appName = cleanAppName(input.appName);
	if (appName) {
		const valid = await validUniqueServerAppName(appName);

		if (!valid) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "Service with this 'AppName' already exists",
			});
		}
	}
	const newDestination = await db
		.insert(compose)
		.values({
			...input,
			appName,
		})
		.returning()
		.then((value) => value[0]);

	if (!newDestination) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error input: Inserting compose",
		});
	}

	return newDestination;
};

export const findComposeById = async (composeId: string) => {
	return orThrowNotFound(
		db.query.compose.findFirst({
			where: eq(compose.composeId, composeId),
			with: {
				environment: {
					with: {
						workspace: true,
					},
				},
				deployments: true,
				mounts: true,
				domains: true,
				github: true,
				gitlab: true,
				bitbucket: true,
				gitea: true,
				runtimeWorker: true,
				backups: {
					with: {
						destination: {
							columns: {
								accessKey: false,
								secretAccessKey: false,
							},
						},
						deployments: true,
					},
				},
			},
		}),
		"Compose",
	);
};

export const findComposeByBackupId = async (backupId: string) => {
	const result = await db
		.select({
			...getTableColumns(compose),
		})
		.from(compose)
		.innerJoin(backups, eq(compose.composeId, backups.composeId))
		.where(eq(backups.backupId, backupId))
		.limit(1);

	if (!result?.[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Compose not found",
		});
	}
	return result[0];
};

export const loadServices = async (
	composeId: string,
	type: "fetch" | "cache" = "fetch",
) => {
	const compose = await findComposeById(composeId);

	if (type === "fetch") {
		const command = await cloneCompose(compose);
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	}

	let composeData: ComposeSpecification | null;

	if (compose.runtimeWorkerId) {
		composeData = await loadDockerComposeRemote(compose);
	} else {
		composeData = await loadDockerCompose(compose);
	}

	if (compose.randomize && composeData) {
		const randomizedCompose = randomizeSpecificationFile(
			composeData,
			compose.suffix,
		);
		composeData = randomizedCompose;
	}

	if (!composeData?.services) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Services not found",
		});
	}

	const services = Object.keys(composeData.services);

	return [...services];
};

export const updateCompose = async (
	composeId: string,
	composeData: Partial<Compose>,
) => {
	const { appName, ...rest } = composeData;
	const composeResult = await db
		.update(compose)
		.set({
			...rest,
		})
		.where(eq(compose.composeId, composeId))
		.returning();

	return composeResult[0];
};

export const deployCompose = async ({
	composeId,
	titleLog = "Manual deployment",
	descriptionLog = "",
}: {
	composeId: string;
	titleLog: string;
	descriptionLog: string;
}) => {
	const compose = await findComposeById(composeId);
	// Binding: re-resolve inbound connection variables from current source state
	// before building, so rotated credentials propagate on this deploy.
	const refreshedEnv = await refreshConnectionVariablesForDeploy({
		environmentId: compose.environmentId,
		serviceType: "compose",
		serviceId: composeId,
	});
	if (refreshedEnv !== null) compose.env = refreshedEnv;

	const buildLink = `${await getInstanceUrl()}${workspaceServicePath({
		workspaceId: compose.environment.workspaceId,
		environmentId: compose.environmentId,
		serviceType: "compose",
		serviceId: compose.composeId,
		tab: "deployments",
	})}`;
	const deployment = await createDeploymentCompose({
		composeId: composeId,
		title: titleLog,
		description: descriptionLog,
	});

	logger.info(
		{
			composeId,
			appName: compose.appName,
			runtimeWorkerId: compose.runtimeWorkerId,
			deploymentId: deployment.deploymentId,
		},
		"Starting compose deployment",
	);

	try {
		const entity = {
			...compose,
			type: "compose" as const,
		};
		let command = "set -e;";
		if (compose.sourceType === "github") {
			command += await cloneGithubRepository(entity);
		} else if (compose.sourceType === "gitlab") {
			command += await cloneGitlabRepository(entity);
		} else if (compose.sourceType === "bitbucket") {
			command += await cloneBitbucketRepository(entity);
		} else if (compose.sourceType === "git") {
			command += await cloneGitRepository(entity);
		} else if (compose.sourceType === "gitea") {
			command += await cloneGiteaRepository(entity);
		} else if (compose.sourceType === "raw") {
			command += getCreateComposeFileCommand(entity);
		}

		let commandWithLog = `(${command}) >> ${deployment.logPath} 2>&1`;
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, commandWithLog);
		} else {
			await execAsync(commandWithLog);
		}
		if (compose.sourceType !== "raw") {
			command = "set -e;";
			command += await generateApplyPatchesCommand({
				id: compose.composeId,
				type: "compose",
				runtimeWorkerId: compose.runtimeWorkerId,
			});
			commandWithLog = `(${command}) >> ${deployment.logPath} 2>&1`;
			if (compose.runtimeWorkerId) {
				await execAsyncRemote(compose.runtimeWorkerId, commandWithLog);
			} else {
				await execAsync(commandWithLog);
			}
		}

		command = "set -e;";
		command += await getBuildComposeCommand(entity);
		commandWithLog = `(${command}) >> ${deployment.logPath} 2>&1`;
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, commandWithLog);
		} else {
			await execAsync(commandWithLog);
		}

		await updateDeploymentStatus(deployment.deploymentId, "done");
		await updateCompose(composeId, {
			composeStatus: "done",
		});

		logger.info(
			{ deploymentId: deployment.deploymentId, composeId },
			"Compose deployment completed",
		);

		await sendBuildSuccessNotifications({
			projectName: compose.environment.workspace.name,
			applicationName: compose.name,
			applicationType: "compose",
			buildLink,
			organizationId: compose.environment.workspace.organizationId,
			domains: compose.domains,
			environmentName: compose.environment.name,
		});
	} catch (error) {
		logger.error(
			{ err: error, deploymentId: deployment.deploymentId, composeId },
			"Compose deployment failed",
		);

		let command = "";

		// Only log details for non-ExecError errors
		if (!(error instanceof ExecError)) {
			const message = error instanceof Error ? error.message : String(error);
			const encodedMessage = encodeBase64(message);
			command += `echo "${encodedMessage}" | base64 -d >> "${deployment.logPath}";`;
		}

		command += `echo "\nError occurred ❌, check the logs for details." >> ${deployment.logPath};`;
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
		await updateDeploymentStatus(deployment.deploymentId, "error");
		await updateCompose(composeId, {
			composeStatus: "error",
		});
		const errorMessage = await getDeploymentErrorMessage({
			logPath: deployment.logPath,
			runtimeWorkerId: compose.runtimeWorkerId,
			fallback: "Error building, check the logs for details.",
		});

		await sendBuildErrorNotifications({
			projectName: compose.environment.workspace.name,
			applicationName: compose.name,
			applicationType: "compose",
			errorMessage,
			buildLink,
			organizationId: compose.environment.workspace.organizationId,
		});
		throw error;
	} finally {
		if (compose.sourceType !== "raw") {
			const commitInfo = await getGitCommitInfo({
				...compose,
				type: "compose",
			});
			if (commitInfo) {
				await updateDeployment(deployment.deploymentId, {
					title: commitInfo.message,
					description: `Commit: ${commitInfo.hash}`,
				});
			}
		}
	}
};

export const rebuildCompose = async ({
	composeId,
	titleLog = "Rebuild deployment",
	descriptionLog = "",
}: {
	composeId: string;
	titleLog: string;
	descriptionLog: string;
}) => {
	const compose = await findComposeById(composeId);
	// Binding: re-resolve inbound connection variables before rebuilding.
	const refreshedEnv = await refreshConnectionVariablesForDeploy({
		environmentId: compose.environmentId,
		serviceType: "compose",
		serviceId: composeId,
	});
	if (refreshedEnv !== null) compose.env = refreshedEnv;

	const deployment = await createDeploymentCompose({
		composeId: composeId,
		title: titleLog,
		description: descriptionLog,
	});

	logger.info(
		{
			composeId,
			appName: compose.appName,
			runtimeWorkerId: compose.runtimeWorkerId,
			deploymentId: deployment.deploymentId,
		},
		"Starting compose rebuild",
	);

	try {
		let command = "set -e;";
		if (compose.sourceType === "raw") {
			command += getCreateComposeFileCommand(compose);
		}

		let commandWithLog = `(${command}) >> ${deployment.logPath} 2>&1`;
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, commandWithLog);
		} else {
			await execAsync(commandWithLog);
		}

		if (compose.sourceType !== "raw") {
			command = "set -e;";
			command += await generateApplyPatchesCommand({
				id: compose.composeId,
				type: "compose",
				runtimeWorkerId: compose.runtimeWorkerId,
			});
			commandWithLog = `(${command}) >> ${deployment.logPath} 2>&1`;
			if (compose.runtimeWorkerId) {
				await execAsyncRemote(compose.runtimeWorkerId, commandWithLog);
			} else {
				await execAsync(commandWithLog);
			}
		}

		command = "set -e;";
		command += await getBuildComposeCommand(compose);
		commandWithLog = `(${command}) >> ${deployment.logPath} 2>&1`;
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, commandWithLog);
		} else {
			await execAsync(commandWithLog);
		}

		await updateDeploymentStatus(deployment.deploymentId, "done");
		await updateCompose(composeId, {
			composeStatus: "done",
		});

		logger.info(
			{ deploymentId: deployment.deploymentId, composeId },
			"Compose rebuild completed",
		);
	} catch (error) {
		logger.error(
			{ err: error, deploymentId: deployment.deploymentId, composeId },
			"Compose rebuild failed",
		);

		let command = "";

		// Only log details for non-ExecError errors
		if (!(error instanceof ExecError)) {
			const message = error instanceof Error ? error.message : String(error);
			const encodedMessage = encodeBase64(message);
			command += `echo "${encodedMessage}" | base64 -d >> "${deployment.logPath}";`;
		}

		command += `echo "\nError occurred ❌, check the logs for details." >> ${deployment.logPath};`;
		if (compose.runtimeWorkerId) {
			await execAsyncRemote(compose.runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
		await updateDeploymentStatus(deployment.deploymentId, "error");
		await updateCompose(composeId, {
			composeStatus: "error",
		});
		throw error;
	}

	return true;
};

export const removeCompose = async (
	compose: Compose,
	deleteVolumes: boolean,
) => {
	try {
		const { COMPOSE_PATH } = paths(!!compose.runtimeWorkerId);
		const projectPath = join(COMPOSE_PATH, compose.appName);

		if (compose.composeType === "stack") {
			const command = `
			docker network disconnect ${compose.appName} docklands-traefik;
			docker stack rm ${compose.appName};
			rm -rf ${projectPath}`;

			if (compose.runtimeWorkerId) {
				await execAsyncRemote(compose.runtimeWorkerId, command);
			} else {
				await execAsync(command);
			}
		} else {
			const command = `
			docker network disconnect ${compose.appName} docklands-traefik;
			env -i PATH="$PATH" docker compose -p ${compose.appName} down ${
				deleteVolumes ? "--volumes" : ""
			};
			rm -rf ${projectPath}`;

			if (compose.runtimeWorkerId) {
				await execAsyncRemote(compose.runtimeWorkerId, command);
			} else {
				await execAsync(command);
			}
		}
	} catch (error) {
		throw error;
	}

	return true;
};

export const startCompose = async (composeId: string) => {
	const compose = await findComposeById(composeId);
	try {
		const { COMPOSE_PATH } = paths(!!compose.runtimeWorkerId);

		const projectPath = join(COMPOSE_PATH, compose.appName, "code");
		const path =
			compose.sourceType === "raw" ? "docker-compose.yml" : compose.composePath;
		const baseCommand = `env -i PATH="$PATH" docker compose -p ${compose.appName} -f ${path} up -d`;
		if (compose.composeType === "docker-compose") {
			if (compose.runtimeWorkerId) {
				await execAsyncRemote(
					compose.runtimeWorkerId,
					`cd ${projectPath} && ${baseCommand}`,
				);
			} else {
				await execAsync(baseCommand, {
					cwd: projectPath,
				});
			}
		} else if (compose.composeType === "stack") {
			// A stack is stopped with `docker stack rm` (see stopCompose), which
			// fully removes the stack — there is nothing to "up" again. Starting it
			// therefore means re-deploying it, which is exactly what the normal
			// deploy path does for a stack. Reuse that same build/deploy command
			// (env file + domains + `docker stack deploy`) against the already-cloned
			// code, mirroring how the docker-compose branch reuses `up -d` without
			// re-cloning the source.
			const buildCommand = await getBuildComposeCommand(compose);
			if (compose.runtimeWorkerId) {
				await execAsyncRemote(compose.runtimeWorkerId, buildCommand);
			} else {
				await execAsync(buildCommand);
			}
		}

		await updateCompose(composeId, {
			composeStatus: "done",
		});
	} catch (error) {
		await updateCompose(composeId, {
			composeStatus: "idle",
		});
		throw error;
	}

	return true;
};

export const stopCompose = async (composeId: string) => {
	const compose = await findComposeById(composeId);
	try {
		const { COMPOSE_PATH } = paths(!!compose.runtimeWorkerId);
		if (compose.composeType === "docker-compose") {
			if (compose.runtimeWorkerId) {
				await execAsyncRemote(
					compose.runtimeWorkerId,
					`cd ${join(COMPOSE_PATH, compose.appName)} && env -i PATH="$PATH" docker compose -p ${
						compose.appName
					} stop`,
				);
			} else {
				await execAsync(
					`env -i PATH="$PATH" docker compose -p ${compose.appName} stop`,
					{
						cwd: join(COMPOSE_PATH, compose.appName),
					},
				);
			}
		}

		if (compose.composeType === "stack") {
			if (compose.runtimeWorkerId) {
				await execAsyncRemote(
					compose.runtimeWorkerId,
					`docker stack rm ${compose.appName}`,
				);
			} else {
				await execAsync(`docker stack rm ${compose.appName}`);
			}
		}

		await updateCompose(composeId, {
			composeStatus: "idle",
		});
	} catch (error) {
		await updateCompose(composeId, {
			composeStatus: "error",
		});
		throw error;
	}

	return true;
};
