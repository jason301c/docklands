import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { zfd } from "zod-form-data";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiCreateApplication,
	apiDeployApplication,
	apiFindMonitoringStats,
	apiFindOneApplication,
	apiRedeployApplication,
	apiReloadApplication,
	apiSaveBitbucketProvider,
	apiSaveBuildType,
	apiSaveDockerProvider,
	apiSaveEnvironmentVariables,
	apiSaveGiteaProvider,
	apiSaveGithubProvider,
	apiSaveGitlabProvider,
	apiSaveGitProvider,
	apiUpdateApplication,
	applications,
	environments,
	workspaces,
} from "@/server/core/db/schema";
import { logger } from "@/server/core/lib/logger";
import { cancelDeployment } from "@/server/core/runtime/deploy";
import {
	createApplication,
	findApplicationById,
	getApplicationStats,
	updateApplication,
	updateApplicationStatus,
} from "@/server/core/services/application";
import {
	clearOldDeployments,
	removeDeployments,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { getContainerLogs } from "@/server/core/services/docker";
import { findEnvironmentById } from "@/server/core/services/environment";
import { canEditDeployGitSource } from "@/server/core/services/git-provider";
import {
	addNewService,
	checkServiceAccess,
	checkServicePermissionAndAccess,
	findMemberByUserId,
} from "@/server/core/services/permission";
import { getAccessibleRuntimeWorkerIds } from "@/server/core/services/runtime-worker";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { findWorkspaceById } from "@/server/core/services/workspace";
import { unzipDrop } from "@/server/core/utils/builders/drop";
import { mechanizeDockerContainer } from "@/server/core/utils/builders/index";
import {
	removeService,
	startService,
	startServiceRemote,
	stopService,
	stopServiceRemote,
} from "@/server/core/utils/docker/utils";
import {
	removeDirectoryCode,
	removeMonitoringDirectory,
} from "@/server/core/utils/filesystem/directory";
import {
	readConfig,
	readRemoteConfig,
	removeTraefikConfig,
	writeConfig,
	writeConfigRemote,
} from "@/server/core/utils/traefik/application";
import { deleteAllMiddlewares } from "@/server/core/utils/traefik/middleware";
import type { DeploymentJob } from "@/server/queues/queue-types";
import {
	cleanQueuesByApplication,
	killDockerBuild,
	myQueue,
} from "@/server/queues/queueSetup";

export const applicationRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateApplication)
		.mutation(async ({ input, ctx }) => {
			try {
				const environment = await findEnvironmentById(input.environmentId);
				const workspace = await findWorkspaceById(environment.workspaceId);

				await checkServiceAccess(ctx, workspace.workspaceId, "create");

				const webServerSettings = await getWebServerSettings();
				if (webServerSettings?.remoteServersOnly && !input.runtimeWorkerId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message:
							"You need to select a runtime worker to create an application",
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

				const newApplication = await createApplication(input);

				await addNewService(ctx, newApplication.applicationId);
				await audit(ctx, {
					action: "create",
					resourceType: "application",
					resourceId: newApplication.applicationId,
					resourceName: newApplication.appName,
				});
				return newApplication;
			} catch (error: unknown) {
				console.log("error", error);
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error creating the application",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOneApplication)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.applicationId, "read");
			const application = await findApplicationById(input.applicationId);
			if (
				application.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this application",
				});
			}

			let hasGitProviderAccess = true;
			let unauthorizedProvider: string | null = null;

			const getGitProviderId = () => {
				switch (application.sourceType) {
					case "github":
						return application.github?.gitProviderId;
					case "gitlab":
						return application.gitlab?.gitProviderId;
					case "bitbucket":
						return application.bitbucket?.gitProviderId;
					case "gitea":
						return application.gitea?.gitProviderId;
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
					unauthorizedProvider = application.sourceType;
				}
			}

			return {
				...application,
				hasGitProviderAccess,
				unauthorizedProvider,
			};
		}),

	reload: protectedProcedure
		.input(apiReloadApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["create"],
			});
			const application = await findApplicationById(input.applicationId);

			try {
				await updateApplicationStatus(input.applicationId, "idle");
				await mechanizeDockerContainer(application);
				await updateApplicationStatus(input.applicationId, "done");
				await audit(ctx, {
					action: "reload",
					resourceType: "application",
					resourceId: application.applicationId,
					resourceName: application.appName,
				});
				return true;
			} catch (error) {
				await updateApplicationStatus(input.applicationId, "error");
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Error reloading application",
					cause: error,
				});
			}
		}),

	delete: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.applicationId, "delete");
			const application = await findApplicationById(input.applicationId);

			if (
				application.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to delete this application",
				});
			}

			const result = await db
				.delete(applications)
				.where(eq(applications.applicationId, input.applicationId))
				.returning();

			await cleanQueuesByApplication(input.applicationId);

			const cleanupOperations = [
				async () => await deleteAllMiddlewares(application),
				async () => await removeDeployments(application),
				async () =>
					await removeDirectoryCode(
						application.appName,
						application.runtimeWorkerId,
					),
				async () =>
					await removeMonitoringDirectory(
						application.appName,
						application.runtimeWorkerId,
					),
				async () =>
					await removeTraefikConfig(
						application.appName,
						application.runtimeWorkerId,
					),
				async () =>
					await removeService(
						application?.appName,
						application.runtimeWorkerId,
					),
			];

			for (const operation of cleanupOperations) {
				try {
					await operation();
				} catch (error) {
					// Best-effort cleanup: keep deleting the rest, but don't swallow
					// silently — a failed step can leave orphaned Docker/Traefik state.
					console.error(
						`Failed to clean up application resource during delete for ${application.appName}:`,
						error,
					);
				}
			}

			await audit(ctx, {
				action: "delete",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return application;
		}),

	stop: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["create"],
			});
			const service = await findApplicationById(input.applicationId);
			if (service.runtimeWorkerId) {
				await stopServiceRemote(service.runtimeWorkerId, service.appName);
			} else {
				await stopService(service.appName);
			}
			await updateApplicationStatus(input.applicationId, "idle");
			await audit(ctx, {
				action: "stop",
				resourceType: "application",
				resourceId: service.applicationId,
				resourceName: service.appName,
			});
			return service;
		}),

	start: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["create"],
			});
			const service = await findApplicationById(input.applicationId);
			if (service.runtimeWorkerId) {
				await startServiceRemote(service.runtimeWorkerId, service.appName);
			} else {
				await startService(service.appName);
			}
			await updateApplicationStatus(input.applicationId, "done");
			await audit(ctx, {
				action: "start",
				resourceType: "application",
				resourceId: service.applicationId,
				resourceName: service.appName,
			});
			return service;
		}),

	redeploy: protectedProcedure
		.input(apiRedeployApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["create"],
			});
			const application = await findApplicationById(input.applicationId);
			const jobData: DeploymentJob = {
				applicationId: input.applicationId,
				titleLog: input.title || "Rebuild deployment",
				descriptionLog: input.description || "",
				type: "redeploy",
				applicationType: "application",
				runtimeWorker: !!application.runtimeWorkerId,
				// Partition by the worker the build actually runs on (the build
				// worker when set — see services/deployment.ts), so per-build-worker
				// concurrency is honored. The handler re-resolves the real target.
				runtimeWorkerId:
					application.buildRuntimeWorkerId ??
					application.runtimeWorkerId ??
					undefined,
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
				action: "rebuild",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
		}),
	saveEnvironment: protectedProcedure
		.input(apiSaveEnvironmentVariables)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				envVars: ["write"],
			});
			await updateApplication(input.applicationId, {
				env: input.env,
				buildArgs: input.buildArgs,
				buildSecrets: input.buildSecrets,
				createEnvFile: input.createEnvFile,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	saveBuildType: protectedProcedure
		.input(apiSaveBuildType)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			// Non-fatal heads-up: a static build with a publishDirectory but
			// isStaticSpa off serves files without the index.html fallback, so
			// client-side routes 404 on refresh/deep-link. The UI only pairs these
			// correctly, but a direct API/OpenAPI caller can set this broken combo —
			// warn rather than reject, since a non-SPA static site is still valid.
			if (
				input.buildType === "static" &&
				input.publishDirectory &&
				!input.isStaticSpa
			) {
				logger.warn(
					{ applicationId: input.applicationId },
					"static build sets publishDirectory without isStaticSpa: client-side routing will 404 on deep-links (no index.html fallback)",
				);
			}
			await updateApplication(input.applicationId, {
				buildType: input.buildType,
				dockerfile: input.dockerfile,
				publishDirectory: input.publishDirectory,
				dockerContextPath: input.dockerContextPath,
				dockerBuildStage: input.dockerBuildStage,
				herokuVersion: input.herokuVersion,
				isStaticSpa: input.isStaticSpa,
				railpackVersion: input.railpackVersion,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	saveGithubProvider: protectedProcedure
		.input(apiSaveGithubProvider)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				repository: input.repository,
				branch: input.branch,
				sourceType: "github",
				owner: input.owner,
				buildPath: input.buildPath,
				applicationStatus: "idle",
				githubId: input.githubId,
				watchPaths: input.watchPaths,
				triggerType: input.triggerType,
				enableSubmodules: input.enableSubmodules,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	saveGitlabProvider: protectedProcedure
		.input(apiSaveGitlabProvider)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				gitlabRepository: input.gitlabRepository,
				gitlabOwner: input.gitlabOwner,
				gitlabBranch: input.gitlabBranch,
				gitlabBuildPath: input.gitlabBuildPath,
				sourceType: "gitlab",
				applicationStatus: "idle",
				gitlabId: input.gitlabId,
				gitlabProjectId: input.gitlabProjectId,
				gitlabPathNamespace: input.gitlabPathNamespace,
				watchPaths: input.watchPaths,
				enableSubmodules: input.enableSubmodules,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	saveBitbucketProvider: protectedProcedure
		.input(apiSaveBitbucketProvider)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				bitbucketRepository: input.bitbucketRepository,
				bitbucketRepositorySlug: input.bitbucketRepositorySlug,
				bitbucketOwner: input.bitbucketOwner,
				bitbucketBranch: input.bitbucketBranch,
				bitbucketBuildPath: input.bitbucketBuildPath,
				sourceType: "bitbucket",
				applicationStatus: "idle",
				bitbucketId: input.bitbucketId,
				watchPaths: input.watchPaths,
				enableSubmodules: input.enableSubmodules,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	saveGiteaProvider: protectedProcedure
		.input(apiSaveGiteaProvider)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				giteaRepository: input.giteaRepository,
				giteaOwner: input.giteaOwner,
				giteaBranch: input.giteaBranch,
				giteaBuildPath: input.giteaBuildPath,
				sourceType: "gitea",
				applicationStatus: "idle",
				giteaId: input.giteaId,
				watchPaths: input.watchPaths,
				enableSubmodules: input.enableSubmodules,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	saveDockerProvider: protectedProcedure
		.input(apiSaveDockerProvider)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				dockerImage: input.dockerImage,
				username: input.username,
				password: input.password,
				sourceType: "docker",
				applicationStatus: "idle",
				registryUrl: input.registryUrl,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	saveGitProvider: protectedProcedure
		.input(apiSaveGitProvider)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				customGitBranch: input.customGitBranch,
				customGitBuildPath: input.customGitBuildPath,
				customGitUrl: input.customGitUrl,
				customGitSSHKeyId: input.customGitSSHKeyId,
				sourceType: "git",
				applicationStatus: "idle",
				watchPaths: input.watchPaths,
				enableSubmodules: input.enableSubmodules,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	disconnectGitProvider: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				repository: null,
				branch: null,
				owner: null,
				buildPath: "/",
				githubId: null,
				triggerType: "push",

				gitlabRepository: null,
				gitlabOwner: null,
				gitlabBranch: null,
				gitlabBuildPath: null,
				gitlabId: null,
				gitlabProjectId: null,
				gitlabPathNamespace: null,

				bitbucketRepository: null,
				bitbucketOwner: null,
				bitbucketBranch: null,
				bitbucketBuildPath: null,
				bitbucketId: null,

				giteaRepository: null,
				giteaOwner: null,
				giteaBranch: null,
				giteaBuildPath: null,
				giteaId: null,

				customGitBranch: null,
				customGitBuildPath: null,
				customGitUrl: null,
				customGitSSHKeyId: null,

				// Reset to a provider-neutral source rather than implying a GitHub
				// connection. All provider + customGit fields above are nulled, so
				// "git" surfaces an unconfigured source the user reconfigures.
				sourceType: "git",
				applicationStatus: "idle",
				watchPaths: null,
				enableSubmodules: false,
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	markRunning: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["create"],
			});
			await updateApplicationStatus(input.applicationId, "running");
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "deploy",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
		}),
	update: protectedProcedure
		.input(apiUpdateApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});

			if (input.buildRuntimeWorkerId) {
				const accessibleIds = await getAccessibleRuntimeWorkerIds(ctx.session);
				if (!accessibleIds.has(input.buildRuntimeWorkerId)) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this build worker",
					});
				}
			}

			const { applicationId, ...rest } = input;
			const updateApp = await updateApplication(applicationId, {
				...rest,
			});

			if (!updateApp) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error updating application",
				});
			}
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: updateApp.applicationId,
				resourceName: updateApp.appName,
			});
			return true;
		}),
	refreshToken: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});
			await updateApplication(input.applicationId, {
				refreshToken: nanoid(),
			});
			const application = await findApplicationById(input.applicationId);
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	deploy: protectedProcedure
		.input(apiDeployApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["create"],
			});
			const application = await findApplicationById(input.applicationId);
			const jobData: DeploymentJob = {
				applicationId: input.applicationId,
				titleLog: input.title || "Manual deployment",
				descriptionLog: input.description || "",
				type: "deploy",
				applicationType: "application",
				runtimeWorker: !!application.runtimeWorkerId,
				// Partition by the worker the build actually runs on (the build
				// worker when set — see services/deployment.ts), so per-build-worker
				// concurrency is honored. The handler re-resolves the real target.
				runtimeWorkerId:
					application.buildRuntimeWorkerId ??
					application.runtimeWorkerId ??
					undefined,
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
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
		}),

	cleanQueues: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["cancel"],
			});
			await cleanQueuesByApplication(input.applicationId);
		}),
	clearDeployments: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["create"],
			});
			const application = await findApplicationById(input.applicationId);
			await clearOldDeployments(
				application.appName,
				application.runtimeWorkerId,
			);
			await audit(ctx, {
				action: "delete",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	killBuild: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["cancel"],
			});
			const application = await findApplicationById(input.applicationId);
			await killDockerBuild("application", application.runtimeWorkerId);
			await audit(ctx, {
				action: "stop",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
		}),
	readTraefikConfig: protectedProcedure
		.input(apiFindOneApplication)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				traefikFiles: ["read"],
			});
			const application = await findApplicationById(input.applicationId);
			let traefikConfig = null;
			if (application.runtimeWorkerId) {
				traefikConfig = await readRemoteConfig(
					application.runtimeWorkerId,
					application.appName,
				);
			} else {
				traefikConfig = readConfig(application.appName);
			}
			return traefikConfig;
		}),

	dropDeployment: protectedProcedure
		.input(
			zfd.formData({
				applicationId: z.string(),
				zip: zfd.file(),
				dropBuildPath: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const zipFile = input.zip;
			const applicationId = input.applicationId;
			const dropBuildPath = input.dropBuildPath ?? null;

			await checkServicePermissionAndAccess(ctx, applicationId, {
				deployment: ["create"],
			});
			const app = await findApplicationById(applicationId);

			// A drop only supplies the source code; the existing buildType still
			// drives the build. dockerfile is the one combo that fails late (and
			// with a generic Docker error) when the uploaded zip doesn't contain
			// the configured Dockerfile, since the file has to come from the
			// upload. Warn up front so the cause is clear in the logs; don't
			// reject — a drop with a Dockerfile inside is a valid setup.
			if (app.buildType === "dockerfile") {
				logger.warn(
					{
						applicationId: app.applicationId,
						dockerfile: app.dockerfile,
					},
					"drop deployment with buildType=dockerfile: the uploaded zip must contain the configured Dockerfile or the build will fail",
				);
			}

			await updateApplication(applicationId, {
				sourceType: "drop",
				dropBuildPath: dropBuildPath || "",
			});

			await unzipDrop(zipFile, app);
			const jobData: DeploymentJob = {
				applicationId: app.applicationId,
				titleLog: "Manual deployment",
				descriptionLog: "",
				type: "deploy",
				applicationType: "application",
				runtimeWorker: !!app.runtimeWorkerId,
				// Partition by the build worker so per-build-worker concurrency holds.
				runtimeWorkerId:
					app.buildRuntimeWorkerId ?? app.runtimeWorkerId ?? undefined,
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
				resourceType: "application",
				resourceId: app.applicationId,
				resourceName: app.appName,
			});
			return true;
		}),
	updateTraefikConfig: protectedProcedure
		.input(z.object({ applicationId: z.string(), traefikConfig: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				traefikFiles: ["write"],
			});
			const application = await findApplicationById(input.applicationId);
			if (application.runtimeWorkerId) {
				await writeConfigRemote(
					application.runtimeWorkerId,
					application.appName,
					input.traefikConfig,
				);
			} else {
				writeConfig(application.appName, input.traefikConfig);
			}
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});
			return true;
		}),
	readAppMonitoring: withPermission("monitoring", "read")
		.input(apiFindMonitoringStats)
		.query(async ({ input }) => {
			const stats = await getApplicationStats(input.appName);

			return stats;
		}),
	move: protectedProcedure
		.input(
			z.object({
				applicationId: z.string(),
				targetEnvironmentId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				service: ["create"],
			});

			const updatedApplication = await db
				.update(applications)
				.set({
					environmentId: input.targetEnvironmentId,
				})
				.where(eq(applications.applicationId, input.applicationId))
				.returning()
				.then((res) => res[0]);

			if (!updatedApplication) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to move application",
				});
			}
			await audit(ctx, {
				action: "update",
				resourceType: "application",
				resourceId: updatedApplication.applicationId,
				resourceName: updatedApplication.appName,
			});
			return updatedApplication;
		}),

	cancelDeployment: protectedProcedure
		.input(apiFindOneApplication)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				deployment: ["cancel"],
			});
			const application = await findApplicationById(input.applicationId);

			try {
				await updateApplicationStatus(input.applicationId, "idle");

				if (application.deployments[0]) {
					await updateDeploymentStatus(
						application.deployments[0].deploymentId,
						"done",
					);
				}

				await cancelDeployment({
					applicationId: input.applicationId,
					applicationType: "application",
				});
				await audit(ctx, {
					action: "stop",
					resourceType: "application",
					resourceId: application.applicationId,
					resourceName: application.appName,
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
				repository: z.string().optional(),
				owner: z.string().optional(),
				dockerImage: z.string().optional(),
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
					eq(applications.environmentId, input.environmentId),
				);
			}

			if (input.q?.trim()) {
				const term = `%${input.q.trim()}%`;
				baseConditions.push(
					or(
						ilike(applications.name, term),
						ilike(applications.appName, term),
						ilike(applications.description ?? "", term),
						ilike(applications.repository ?? "", term),
						ilike(applications.owner ?? "", term),
						ilike(applications.dockerImage ?? "", term),
					)!,
				);
			}

			if (input.name?.trim()) {
				baseConditions.push(ilike(applications.name, `%${input.name.trim()}%`));
			}
			if (input.appName?.trim()) {
				baseConditions.push(
					ilike(applications.appName, `%${input.appName.trim()}%`),
				);
			}
			if (input.description?.trim()) {
				baseConditions.push(
					ilike(
						applications.description ?? "",
						`%${input.description.trim()}%`,
					),
				);
			}
			if (input.repository?.trim()) {
				baseConditions.push(
					ilike(applications.repository ?? "", `%${input.repository.trim()}%`),
				);
			}
			if (input.owner?.trim()) {
				baseConditions.push(
					ilike(applications.owner ?? "", `%${input.owner.trim()}%`),
				);
			}
			if (input.dockerImage?.trim()) {
				baseConditions.push(
					ilike(
						applications.dockerImage ?? "",
						`%${input.dockerImage.trim()}%`,
					),
				);
			}

			const { accessedServices } = await findMemberByUserId(
				ctx.user.id,
				ctx.session.activeOrganizationId,
			);
			if (accessedServices.length === 0) return { items: [], total: 0 };
			baseConditions.push(
				sql`${applications.applicationId} IN (${sql.join(
					accessedServices.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			);

			const where = and(...baseConditions);

			const [items, countResult] = await Promise.all([
				db
					.select({
						applicationId: applications.applicationId,
						name: applications.name,
						appName: applications.appName,
						description: applications.description,
						environmentId: applications.environmentId,
						applicationStatus: applications.applicationStatus,
						sourceType: applications.sourceType,
						createdAt: applications.createdAt,
					})
					.from(applications)
					.innerJoin(
						environments,
						eq(applications.environmentId, environments.environmentId),
					)
					.innerJoin(
						workspaces,
						eq(environments.workspaceId, workspaces.workspaceId),
					)
					.where(where)
					.orderBy(desc(applications.createdAt))
					.limit(input.limit)
					.offset(input.offset),
				db
					.select({ count: sql<number>`count(*)::int` })
					.from(applications)
					.innerJoin(
						environments,
						eq(applications.environmentId, environments.environmentId),
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
			apiFindOneApplication.extend({
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
			await checkServiceAccess(ctx, input.applicationId, "read");
			const application = await findApplicationById(input.applicationId);
			if (
				application.environment.workspace.organizationId !==
				ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this application",
				});
			}
			return await getContainerLogs(
				application.appName,
				input.tail,
				input.since,
				input.search,
				application.runtimeWorkerId,
			);
		}),
});
