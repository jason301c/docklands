import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import _ from "lodash";
import { nanoid } from "nanoid";
import { stringify } from "yaml";
import { z } from "zod";
import { db } from "@/server/core/db";
import {
	apiCreateCompose,
	apiDeleteCompose,
	apiDeployCompose,
	apiFetchServices,
	apiFindCompose,
	apiRandomizeCompose,
	apiRedeployCompose,
	apiSaveEnvironmentVariablesCompose,
	apiUpdateCompose,
	compose as composeTable,
	environments,
	serviceDatabase,
	workspaces,
} from "@/server/core/db/schema";
import { cancelDeployment } from "@/server/core/runtime/deploy";
import {
	createCompose,
	createComposeByTemplate,
	findComposeById,
	loadServices,
	removeCompose,
	startCompose,
	stopCompose,
	updateCompose,
} from "@/server/core/services/compose";
import {
	clearOldDeployments,
	removeDeploymentsByComposeId,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { getContainerLogs } from "@/server/core/services/docker";
import {
	createDomain,
	findDomainsByComposeId,
	removeDomainById,
} from "@/server/core/services/domain";
import { findEnvironmentById } from "@/server/core/services/environment";
import { canEditDeployGitSource } from "@/server/core/services/git-provider";
import { createMount, deleteMount } from "@/server/core/services/mount";
import {
	addNewService,
	checkServiceAccess,
	checkServicePermissionAndAccess,
	findMemberByUserId,
} from "@/server/core/services/permission";
import {
	findRuntimeWorkerById,
	getAccessibleRuntimeWorkerIds,
} from "@/server/core/services/runtime-worker";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { findWorkspaceById } from "@/server/core/services/workspace";
import { generatePassword } from "@/server/core/templates";
import {
	loadTemplateCatalog,
	loadTemplateDefinition,
} from "@/server/core/templates/catalog";
import { processComposeTemplate } from "@/server/core/templates/processors";
import { createCommand } from "@/server/core/utils/builders/compose";
import { randomizeIsolatedDeploymentComposeFile } from "@/server/core/utils/docker/collision";
import { randomizeComposeFile } from "@/server/core/utils/docker/compose";
import {
	addDomainToCompose,
	cloneCompose,
} from "@/server/core/utils/docker/domain";
import { getComposeContainer } from "@/server/core/utils/docker/utils";
import { removeComposeDirectory } from "@/server/core/utils/filesystem/directory";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import type { DeploymentJob } from "@/server/queues/queue-types";
import {
	cleanQueuesByCompose,
	killDockerBuild,
	myQueue,
} from "@/server/queues/queueSetup";
import { slugify } from "@/shared/slug";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { audit } from "../utils/audit";

const decodeComposeTemplatePayload = (base64: string) => {
	const decodedData = Buffer.from(base64, "base64").toString("utf-8");
	try {
		const parsed = JSON.parse(decodedData) as unknown;
		if (
			parsed &&
			typeof parsed === "object" &&
			"compose" in parsed &&
			typeof (parsed as { compose?: unknown }).compose === "string"
		) {
			return (parsed as { compose: string }).compose;
		}
	} catch {}
	return decodedData;
};

const getTemplateServerIp = async (runtimeWorkerId?: string) => {
	if (runtimeWorkerId) {
		const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);
		return runtimeWorker.ipAddress;
	}
	if (process.env.NODE_ENV === "development") {
		return "127.0.0.1";
	}
	const settings = await getWebServerSettings();
	return settings?.serverIp || "127.0.0.1";
};

const persistProcessedTemplateRecords = async (
	composeId: string,
	processed: ReturnType<typeof processComposeTemplate>,
) => {
	for (const mount of processed.mounts) {
		await createMount({
			filePath: mount.filePath,
			mountPath: mount.mountPath || "/",
			content: mount.content,
			serviceId: composeId,
			serviceType: "compose",
			type: "file",
		});
	}

	for (const domain of processed.domains) {
		await createDomain({
			...domain,
			domainType: "compose",
			certificateType: "none",
			composeId,
			host: domain.host,
		});
	}

	// Detection bridge: promote databases detected inside the stack to
	// `service_database` so they become first-class for backups and connection
	// variables (auto-detect, opt-out — the locked decision).
	for (const detected of processed.databases) {
		await db.insert(serviceDatabase).values({
			composeId,
			serviceName: detected.serviceName,
			engine: detected.engine,
			image: detected.image,
			config: detected.config as (typeof serviceDatabase.$inferInsert)["config"],
		});
	}
};

export const composeRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateCompose)
		.mutation(async ({ ctx, input }) => {
			try {
				const environment = await findEnvironmentById(input.environmentId);
				const workspace = await findWorkspaceById(environment.workspaceId);

				await checkServiceAccess(ctx, workspace.workspaceId, "create");

				const webServerSettings = await getWebServerSettings();
				if (webServerSettings?.remoteServersOnly && !input.runtimeWorkerId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You need to select a runtime worker to create a compose",
					});
				}
				if (workspace.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this workspace",
					});
				}

				if (input.runtimeWorkerId) {
					const accessibleIds = await getAccessibleRuntimeWorkerIds(
						ctx.session,
					);
					if (!accessibleIds.has(input.runtimeWorkerId)) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You are not authorized to access this runtime worker",
						});
					}
				}

				const newService = await createCompose({
					...input,
				});

				await addNewService(ctx, newService.composeId);

				await audit(ctx, {
					action: "create",
					resourceType: "service",
					resourceId: newService.composeId,
					resourceName: newService.appName,
				});
				return newService;
			} catch (error) {
				throw error;
			}
		}),

	one: protectedProcedure
		.input(apiFindCompose)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.composeId, "read");

			const compose = await findComposeById(input.composeId);
			if (
				compose.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this compose",
				});
			}

			let hasGitProviderAccess = true;
			let unauthorizedProvider: string | null = null;

			const getGitProviderId = () => {
				switch (compose.sourceType) {
					case "github":
						return compose.github?.gitProviderId;
					case "gitlab":
						return compose.gitlab?.gitProviderId;
					case "bitbucket":
						return compose.bitbucket?.gitProviderId;
					case "gitea":
						return compose.gitea?.gitProviderId;
					default:
						return null;
				}
			};

			const gitProviderId = getGitProviderId();

			if (gitProviderId) {
				const canEdit = await canEditDeployGitSource(
					gitProviderId,
					ctx.session,
				);
				if (!canEdit) {
					hasGitProviderAccess = false;
					unauthorizedProvider = compose.sourceType;
				}
			}

			return {
				...compose,
				hasGitProviderAccess,
				unauthorizedProvider,
			};
		}),

	update: protectedProcedure
		.input(apiUpdateCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			const updated = await updateCompose(input.composeId, input);
			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: updated?.name,
			});
			return updated;
		}),
	saveEnvironment: protectedProcedure
		.input(apiSaveEnvironmentVariablesCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				envVars: ["write"],
			});
			const updated = await updateCompose(input.composeId, {
				env: input.env,
			});

			if (!updated) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error adding environment variables",
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: updated?.name,
			});
			return true;
		}),
	delete: protectedProcedure
		.input(apiDeleteCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.composeId, "delete");
			const composeResult = await findComposeById(input.composeId);

			if (
				composeResult.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to delete this compose",
				});
			}

			const result = await db
				.delete(composeTable)
				.where(eq(composeTable.composeId, input.composeId))
				.returning();

			await cleanQueuesByCompose(input.composeId);

			const cleanupOperations = [
				async () => await removeCompose(composeResult, input.deleteVolumes),
				async () => await removeDeploymentsByComposeId(composeResult),
				async () => await removeComposeDirectory(composeResult.appName),
			];

			for (const operation of cleanupOperations) {
				try {
					await operation();
				} catch (_) {}
			}

			await audit(ctx, {
				action: "delete",
				resourceType: "service",
				resourceId: composeResult.composeId,
				resourceName: composeResult.appName,
			});
			return composeResult;
		}),
	cleanQueues: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["create"],
			});
			await cleanQueuesByCompose(input.composeId);
			return { success: true, message: "Queues cleaned successfully" };
		}),
	clearDeployments: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["create"],
			});
			const compose = await findComposeById(input.composeId);
			await clearOldDeployments(compose.appName, compose.runtimeWorkerId);
			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: compose.name,
			});
			return true;
		}),
	killBuild: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["cancel"],
			});
			const compose = await findComposeById(input.composeId);
			await killDockerBuild("compose", compose.runtimeWorkerId);
		}),

	loadServices: protectedProcedure
		.input(apiFetchServices)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["read"],
			});
			return await loadServices(input.composeId, input.type);
		}),
	loadMountsByService: protectedProcedure
		.input(
			z.object({
				composeId: z.string().min(1),
				serviceName: z.string().min(1),
			}),
		)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			const compose = await findComposeById(input.composeId);
			const container = await getComposeContainer(compose, input.serviceName);
			const mounts = container?.Mounts.filter(
				(mount) => mount.Type === "volume" && mount.Source !== "",
			);
			return mounts;
		}),
	fetchSourceType: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			try {
				await checkServicePermissionAndAccess(ctx, input.composeId, {
					service: ["create"],
				});
				const compose = await findComposeById(input.composeId);

				const command = await cloneCompose(compose);
				if (compose.runtimeWorkerId) {
					await execAsyncRemote(compose.runtimeWorkerId, command);
				} else {
					await execAsync(command);
				}
				return compose.sourceType;
			} catch (err) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error fetching source type",
					cause: err,
				});
			}
		}),

	randomizeCompose: protectedProcedure
		.input(apiRandomizeCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			const result = await randomizeComposeFile(input.composeId, input.suffix);
			const compose = await findComposeById(input.composeId);
			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: compose.name,
			});
			return result;
		}),
	isolatedDeployment: protectedProcedure
		.input(apiRandomizeCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			const result = await randomizeIsolatedDeploymentComposeFile(
				input.composeId,
				input.suffix,
			);
			const compose = await findComposeById(input.composeId);
			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: compose.name,
			});
			return result;
		}),
	getConvertedCompose: protectedProcedure
		.input(apiFindCompose)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			const compose = await findComposeById(input.composeId);
			const domains = await findDomainsByComposeId(input.composeId);
			const composeFile = await addDomainToCompose(compose, domains);
			return stringify(composeFile, {
				lineWidth: 1000,
			});
		}),

	deploy: protectedProcedure
		.input(apiDeployCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["create"],
			});
			const compose = await findComposeById(input.composeId);

			const jobData: DeploymentJob = {
				composeId: input.composeId,
				titleLog: input.title || "Manual deployment",
				type: "deploy",
				applicationType: "compose",
				descriptionLog: input.description || "",
				runtimeWorker: !!compose.runtimeWorkerId,
				runtimeWorkerId: compose.runtimeWorkerId ?? undefined,
			};

			await myQueue.add(
				"deployments",
				{ ...jobData },
				{
					removeOnComplete: true,
					removeOnFail: true,
				},
			);
			await audit(ctx, {
				action: "deploy",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: compose.name,
			});
			return {
				success: true,
				message: "Deployment queued",
				composeId: compose.composeId,
			};
		}),
	redeploy: protectedProcedure
		.input(apiRedeployCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["create"],
			});
			const compose = await findComposeById(input.composeId);
			const jobData: DeploymentJob = {
				composeId: input.composeId,
				titleLog: input.title || "Rebuild deployment",
				type: "redeploy",
				applicationType: "compose",
				descriptionLog: input.description || "",
				runtimeWorker: !!compose.runtimeWorkerId,
				runtimeWorkerId: compose.runtimeWorkerId ?? undefined,
			};
			await myQueue.add(
				"deployments",
				{ ...jobData },
				{
					removeOnComplete: true,
					removeOnFail: true,
				},
			);
			await audit(ctx, {
				action: "deploy",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: compose.name,
			});
			return {
				success: true,
				message: "Redeployment queued",
				composeId: compose.composeId,
			};
		}),
	stop: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["create"],
			});
			await stopCompose(input.composeId);
			const composeForStop = await findComposeById(input.composeId);
			await audit(ctx, {
				action: "stop",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: composeForStop.name,
			});
			return true;
		}),
	start: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["create"],
			});
			await startCompose(input.composeId);
			const composeForStart = await findComposeById(input.composeId);
			await audit(ctx, {
				action: "start",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: composeForStart.name,
			});
			return true;
		}),
	getDefaultCommand: protectedProcedure
		.input(apiFindCompose)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			const compose = await findComposeById(input.composeId);
			const command = createCommand(compose);
			return `docker ${command}`;
		}),
	refreshToken: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});
			await updateCompose(input.composeId, {
				refreshToken: nanoid(),
			});
			const composeForToken = await findComposeById(input.composeId);
			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: composeForToken.name,
			});
			return true;
		}),
	deployTemplate: protectedProcedure
		.input(
			z.object({
				environmentId: z.string(),
				runtimeWorkerId: z.string().optional(),
				id: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const environment = await findEnvironmentById(input.environmentId);

			await checkServiceAccess(ctx, environment.workspaceId, "create");

			const webServerSettings = await getWebServerSettings();
			if (webServerSettings?.remoteServersOnly && !input.runtimeWorkerId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You need to select a runtime worker to create a compose",
				});
			}

			if (input.runtimeWorkerId) {
				const accessibleIds = await getAccessibleRuntimeWorkerIds(ctx.session);
				if (!accessibleIds.has(input.runtimeWorkerId)) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this runtime worker",
					});
				}
			}

			const workspace = await findWorkspaceById(environment.workspaceId);
			const template = await loadTemplateDefinition(input.id);
			const serverIp = await getTemplateServerIp(input.runtimeWorkerId);

			const projectName = slugify(`${workspace.name} ${input.id}`);
			const appName = `${projectName}-${generatePassword(6)}`;
			const processed = processComposeTemplate(template.compose, {
				appName,
				serverIp,
				projectName,
				defaultPort: template.metadata.port,
			});

			const compose = await createComposeByTemplate({
				...input,
				composeFile: processed.compose,
				env: processed.envs.join("\n"),
				runtimeWorkerId: input.runtimeWorkerId,
				name: template.metadata.name,
				sourceType: "raw",
				appName: appName,
				isolatedDeployment: true,
			});

			await addNewService(ctx, compose.composeId);
			await persistProcessedTemplateRecords(compose.composeId, processed);

			await audit(ctx, {
				action: "create",
				resourceType: "compose",
				resourceId: compose.composeId,
				resourceName: compose.name,
			});
			return compose;
		}),

	templates: protectedProcedure.input(z.object({})).query(async () => {
		try {
			const templates = await loadTemplateCatalog();

			if (templates.length > 0) {
				return templates;
			}
		} catch (error) {
			console.warn("Failed to read local templates:", error);
		}
		return [];
	}),

	getTags: protectedProcedure.input(z.object({})).query(async () => {
		try {
			const templates = await loadTemplateCatalog();
			const allTags = templates.flatMap((template) => template.tags);
			return _.uniq(allTags);
		} catch (error) {
			console.warn("Failed to fetch template tags:", error);
			return [];
		}
	}),
	disconnectGitProvider: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});

			await updateCompose(input.composeId, {
				repository: null,
				branch: null,
				owner: null,
				composePath: undefined,
				githubId: null,
				triggerType: "push",

				gitlabRepository: null,
				gitlabOwner: null,
				gitlabBranch: null,
				gitlabId: null,
				gitlabProjectId: null,
				gitlabPathNamespace: null,

				bitbucketRepository: null,
				bitbucketOwner: null,
				bitbucketBranch: null,
				bitbucketId: null,

				giteaRepository: null,
				giteaOwner: null,
				giteaBranch: null,
				giteaId: null,

				customGitBranch: null,
				customGitUrl: null,
				customGitSSHKeyId: null,

				sourceType: "github", // Reset to default
				composeStatus: "idle",
				watchPaths: null,
				enableSubmodules: false,
			});

			const composeForDisconnect = await findComposeById(input.composeId);
			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: composeForDisconnect.name,
			});
			return true;
		}),

	move: protectedProcedure
		.input(
			z.object({
				composeId: z.string(),
				targetEnvironmentId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				service: ["create"],
			});

			const updatedCompose = await db
				.update(composeTable)
				.set({
					environmentId: input.targetEnvironmentId,
				})
				.where(eq(composeTable.composeId, input.composeId))
				.returning()
				.then((res) => res[0]);

			if (!updatedCompose) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to move compose",
				});
			}

			await audit(ctx, {
				action: "update",
				resourceType: "compose",
				resourceId: input.composeId,
				resourceName: updatedCompose.name,
			});
			return updatedCompose;
		}),

	processTemplate: protectedProcedure
		.input(
			z.object({
				base64: z.string(),
				composeId: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				await checkServicePermissionAndAccess(ctx, input.composeId, {
					service: ["create"],
				});
				const compose = await findComposeById(input.composeId);
				const composeContent = decodeComposeTemplatePayload(input.base64);
				const serverIp = await getTemplateServerIp(
					compose.runtimeWorkerId || undefined,
				);
				const processedTemplate = processComposeTemplate(composeContent, {
					appName: compose.appName,
					serverIp,
					projectName: compose.appName,
				});

				return {
					compose: processedTemplate.compose,
					template: processedTemplate,
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error processing template: ${error instanceof Error ? error.message : error}`,
				});
			}
		}),

	previewTemplate: protectedProcedure
		.input(
			z.object({
				base64: z.string(),
				appName: z.string(),
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				if (input.runtimeWorkerId) {
					const accessibleIds = await getAccessibleRuntimeWorkerIds(
						ctx.session,
					);
					if (!accessibleIds.has(input.runtimeWorkerId)) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You are not authorized to access this runtime worker",
						});
					}
				}

				const composeContent = decodeComposeTemplatePayload(input.base64);
				const serverIp = await getTemplateServerIp(input.runtimeWorkerId);
				const processedTemplate = processComposeTemplate(composeContent, {
					appName: input.appName,
					serverIp,
					projectName: input.appName,
				});

				return {
					compose: processedTemplate.compose,
					template: processedTemplate,
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error processing template: ${error instanceof Error ? error.message : error}`,
				});
			}
		}),

	import: protectedProcedure
		.input(
			z.object({
				base64: z.string(),
				composeId: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				await checkServicePermissionAndAccess(ctx, input.composeId, {
					service: ["create"],
				});
				const compose = await findComposeById(input.composeId);
				const composeContent = decodeComposeTemplatePayload(input.base64);

				for (const mount of compose.mounts) {
					await deleteMount(mount.mountId);
				}

				for (const domain of compose.domains) {
					await removeDomainById(domain.domainId);
				}

				const serverIp = await getTemplateServerIp(
					compose.runtimeWorkerId || undefined,
				);
				const processedTemplate = processComposeTemplate(composeContent, {
					appName: compose.appName,
					serverIp,
					projectName: compose.appName,
				});

				await updateCompose(input.composeId, {
					composeFile: processedTemplate.compose,
					sourceType: "raw",
					env: processedTemplate.envs.join("\n"),
					isolatedDeployment: true,
				});
				await persistProcessedTemplateRecords(
					compose.composeId,
					processedTemplate,
				);

				await audit(ctx, {
					action: "update",
					resourceType: "compose",
					resourceId: input.composeId,
					resourceName: compose.appName,
				});
				return {
					success: true,
					message: "Template imported successfully",
				};
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error importing template: ${error instanceof Error ? error.message : error}`,
				});
			}
		}),

	cancelDeployment: protectedProcedure
		.input(apiFindCompose)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				deployment: ["cancel"],
			});
			const compose = await findComposeById(input.composeId);

			try {
				await updateCompose(input.composeId, {
					composeStatus: "idle",
				});

				if (compose.deployments[0]) {
					await updateDeploymentStatus(
						compose.deployments[0].deploymentId,
						"done",
					);
				}

				await cancelDeployment({
					composeId: input.composeId,
					applicationType: "compose",
				});

				await audit(ctx, {
					action: "stop",
					resourceType: "compose",
					resourceId: input.composeId,
					resourceName: compose.name,
				});
				return {
					success: true,
					message: "Deployment cancellation requested",
				};
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						error instanceof Error
							? error.message
							: "Failed to cancel deployment",
				});
			}
		}),

	search: protectedProcedure
		.input(
			z.object({
				q: z.string().optional(),
				name: z.string().optional(),
				appName: z.string().optional(),
				description: z.string().optional(),
				workspaceId: z.string().optional(),
				environmentId: z.string().optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const baseConditions = [
				eq(workspaces.organizationId, ctx.session.activeOrganizationId),
			];

			if (input.workspaceId) {
				baseConditions.push(eq(environments.workspaceId, input.workspaceId));
			}
			if (input.environmentId) {
				baseConditions.push(
					eq(composeTable.environmentId, input.environmentId),
				);
			}

			if (input.q?.trim()) {
				const term = `%${input.q.trim()}%`;
				baseConditions.push(
					or(
						ilike(composeTable.name, term),
						ilike(composeTable.appName, term),
						ilike(composeTable.description ?? "", term),
					)!,
				);
			}

			if (input.name?.trim()) {
				baseConditions.push(ilike(composeTable.name, `%${input.name.trim()}%`));
			}
			if (input.appName?.trim()) {
				baseConditions.push(
					ilike(composeTable.appName, `%${input.appName.trim()}%`),
				);
			}
			if (input.description?.trim()) {
				baseConditions.push(
					ilike(
						composeTable.description ?? "",
						`%${input.description.trim()}%`,
					),
				);
			}

			const { accessedServices } = await findMemberByUserId(
				ctx.user.id,
				ctx.session.activeOrganizationId,
			);
			if (accessedServices.length === 0) return { items: [], total: 0 };
			baseConditions.push(
				sql`${composeTable.composeId} IN (${sql.join(
					accessedServices.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			);

			const where = and(...baseConditions);

			const [items, countResult] = await Promise.all([
				db
					.select({
						composeId: composeTable.composeId,
						name: composeTable.name,
						appName: composeTable.appName,
						description: composeTable.description,
						environmentId: composeTable.environmentId,
						composeStatus: composeTable.composeStatus,
						sourceType: composeTable.sourceType,
						createdAt: composeTable.createdAt,
					})
					.from(composeTable)
					.innerJoin(
						environments,
						eq(composeTable.environmentId, environments.environmentId),
					)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where)
					.orderBy(desc(composeTable.createdAt))
					.limit(input.limit)
					.offset(input.offset),
				db
					.select({ count: sql<number>`count(*)::int` })
					.from(composeTable)
					.innerJoin(
						environments,
						eq(composeTable.environmentId, environments.environmentId),
					)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where),
			]);

			return {
				items,
				total: countResult[0]?.count ?? 0,
			};
		}),

	readLogs: protectedProcedure
		.input(
			apiFindCompose.extend({
				containerId: z
					.string()
					.min(1)
					.regex(/^[a-zA-Z0-9.\-_]+$/, "Invalid container id."),
				tail: z.number().int().min(1).max(10000).default(100),
				since: z
					.string()
					.regex(/^(all|\d+[smhd])$/, "Invalid since format")
					.default("all"),
				search: z
					.string()
					.regex(/^[a-zA-Z0-9 ._-]{0,500}$/)
					.optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.composeId, "read");
			const compose = await findComposeById(input.composeId);
			if (
				compose.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this compose",
				});
			}
			return await getContainerLogs(
				input.containerId,
				input.tail,
				input.since,
				input.search,
				compose.runtimeWorkerId,
				true,
			);
		}),
});
