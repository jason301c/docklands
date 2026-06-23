import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { scheduledJobs, scheduleJob } from "node-schedule";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { CLEANUP_CRON_JOB } from "@/server/core/constants/cleanup";
import { paths } from "@/server/core/constants/paths";
import { db } from "@/server/core/db";
import {
	apiAssignDomain,
	apiEnableDashboard,
	apiModifyTraefikConfig,
	apiReadStatsLogs,
	apiReadTraefikConfig,
	apiRuntimeWorkerSchema,
	apiSaveSSHKey,
	apiTraefikConfig,
	apiUpdateDockerCleanup,
	apiUpdateWebServerBuildsConcurrency,
	runtimeWorkers,
	workspaces,
} from "@/server/core/db/schema";
import { generateOpenApiDocument } from "@/server/core/openapi/generator/index.mjs";
import { checkPermission } from "@/server/core/services/permission";
import {
	findRuntimeWorkerById,
	updateRuntimeWorkerById,
} from "@/server/core/services/runtime-worker";
import {
	checkPortInUse,
	getDocklandsImageTag,
	getUpdateData,
	readDirectory,
	readEnvironmentVariables,
	readPorts,
	reloadDockerResource,
	writeTraefikSetup,
} from "@/server/core/services/settings";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "@/server/core/services/web-server-settings";
import {
	getLogCleanupStatus,
	startLogCleanup,
	stopLogCleanup,
} from "@/server/core/utils/access-log/handler";
import {
	parseRawConfig,
	processLogs,
} from "@/server/core/utils/access-log/utils";
import {
	checkPostgresHealth,
	checkTraefikHealth,
	cleanupAll,
	cleanupAllBackground,
	cleanupBuilders,
	cleanupContainers,
	cleanupImages,
	cleanupSystem,
	cleanupVolumes,
	getDockerDiskUsage,
	prepareEnvironmentVariables,
} from "@/server/core/utils/docker/utils";
import { recreateDirectory } from "@/server/core/utils/filesystem/directory";
import { checkGPUStatus, setupGPUSupport } from "@/server/core/utils/gpu-setup";
import { sendDockerCleanupNotifications } from "@/server/core/utils/notifications/docker-cleanup";
import { spawnAsync } from "@/server/core/utils/process/spawnAsync";
import {
	readConfig,
	readConfigInPath,
	readMonitoringConfig,
	writeConfig,
	writeTraefikConfigInPath,
} from "@/server/core/utils/traefik/application";
import {
	readMainConfig,
	updateLetsEncryptEmail,
	updateServerTraefik,
	writeMainConfig,
} from "@/server/core/utils/traefik/web-server";
import { assertBuildsConcurrencyAllowed } from "@/server/queues/concurrency";
import { cleanAllDeploymentQueue } from "@/server/queues/queueSetup";
import packageInfo from "../../../package.json";
import { appRouter } from "../root";
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "../trpc";

const DOCKLANDS_IMAGE = process.env.DOCKLANDS_IMAGE || "jason301c/docklands";

export const settingsRouter = createTRPCRouter({
	getWebServerSettings: protectedProcedure.query(async () => {
		const settings = await getWebServerSettings();
		if (!settings) {
			return settings;
		}
		// Never expose the host SSH private key to clients. It is only consumed
		// server-side; the UI only needs to know whether one is configured.
		return { ...settings, sshPrivateKey: null };
	}),
	reloadServer: adminProcedure.mutation(async ({ ctx }) => {
		await reloadDockerResource("docklands", undefined, packageInfo.version);
		await audit(ctx, {
			action: "reload",
			resourceType: "settings",
			resourceName: "docklands",
		});
		return true;
	}),
	cleanAllDeploymentQueue: adminProcedure.mutation(async ({ ctx }) => {
		const result = cleanAllDeploymentQueue();
		await audit(ctx, {
			action: "update",
			resourceType: "settings",
			resourceName: "clean-deployment-queue",
		});
		return result;
	}),
	reloadTraefik: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.mutation(async ({ input, ctx }) => {
			// Run in background so the request returns immediately; avoids proxy timeouts.
			void reloadDockerResource(
				"docklands-traefik",
				input?.runtimeWorkerId,
			).catch((err) => {
				console.error("reloadTraefik background:", err);
			});
			await audit(ctx, {
				action: "reload",
				resourceType: "settings",
				resourceName: "docklands-traefik",
			});
			return true;
		}),
	toggleDashboard: adminProcedure
		.input(apiEnableDashboard)
		.mutation(async ({ input, ctx }) => {
			const ports = await readPorts("docklands-traefik", input.runtimeWorkerId);
			const env = await readEnvironmentVariables(
				"docklands-traefik",
				input.runtimeWorkerId,
			);
			const preparedEnv = prepareEnvironmentVariables(env);
			let newPorts = ports;
			// If receive true, add 8080 to ports
			if (input.enableDashboard) {
				// Check if port 8080 is already in use before enabling dashboard
				const portCheck = await checkPortInUse(8080, input.runtimeWorkerId);
				if (portCheck.isInUse) {
					const conflictInfo = portCheck.conflictingContainer
						? ` by ${portCheck.conflictingContainer}`
						: "";
					throw new TRPCError({
						code: "CONFLICT",
						message: `Port 8080 is already in use${conflictInfo}. Please stop the conflicting service or use a different port for the Traefik dashboard.`,
					});
				}
				newPorts.push({
					targetPort: 8080,
					publishedPort: 8080,
					protocol: "tcp",
				});
			} else {
				newPorts = ports.filter((port) => port.targetPort !== 8080);
			}

			// Run in background so the request returns immediately; client polls /api/health.
			// Avoids proxy timeouts (520) while Traefik is recreated.
			void writeTraefikSetup({
				env: preparedEnv,
				additionalPorts: newPorts,
				runtimeWorkerId: input.runtimeWorkerId,
			}).catch((err) => {
				console.error("toggleDashboard background writeTraefikSetup:", err);
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "toggle-dashboard",
			});
			return true;
		}),
	cleanUnusedImages: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupImages(input?.runtimeWorkerId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-unused-images",
			});
			return true;
		}),
	cleanUnusedVolumes: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupVolumes(input?.runtimeWorkerId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-unused-volumes",
			});
			return true;
		}),
	cleanStoppedContainers: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupContainers(input?.runtimeWorkerId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-stopped-containers",
			});
			return true;
		}),
	cleanDockerBuilder: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupBuilders(input?.runtimeWorkerId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-docker-builder",
			});
		}),
	cleanDockerPrune: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.mutation(async ({ input, ctx }) => {
			await cleanupSystem(input?.runtimeWorkerId);
			await cleanupBuilders(input?.runtimeWorkerId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-docker-prune",
			});
			return true;
		}),
	cleanAll: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.mutation(async ({ input, ctx }) => {
			// Execute cleanup in background and return immediately to avoid gateway timeouts
			const result = await cleanupAllBackground(input?.runtimeWorkerId);
			await audit(ctx, {
				action: "delete",
				resourceType: "settings",
				resourceName: "clean-all",
			});
			return result;
		}),
	cleanMonitoring: adminProcedure.mutation(async ({ ctx }) => {
		const { MONITORING_PATH } = paths();
		await recreateDirectory(MONITORING_PATH);
		await audit(ctx, {
			action: "delete",
			resourceType: "settings",
			resourceName: "clean-monitoring",
		});
		return true;
	}),
	getDockerDiskUsage: adminProcedure.query(async () => {
		return getDockerDiskUsage();
	}),
	saveSSHPrivateKey: adminProcedure
		.input(apiSaveSSHKey)
		.mutation(async ({ input, ctx }) => {
			await updateWebServerSettings({
				sshPrivateKey: input.sshPrivateKey,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "ssh-private-key",
			});
			return true;
		}),
	assignDomainServer: adminProcedure
		.input(apiAssignDomain)
		.mutation(async ({ input, ctx }) => {
			const settings = await updateWebServerSettings({
				host: input.host,
				letsEncryptEmail: input.letsEncryptEmail,
				certificateType: input.certificateType,
				https: input.https,
			});

			if (!settings) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Web server settings not found",
				});
			}

			updateServerTraefik(settings, input.host);
			if (input.letsEncryptEmail) {
				updateLetsEncryptEmail(input.letsEncryptEmail);
			}

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "assign-domain-runtimeWorker",
			});
			return settings;
		}),
	cleanSSHPrivateKey: adminProcedure.mutation(async ({ ctx }) => {
		await updateWebServerSettings({
			sshPrivateKey: null,
		});
		await audit(ctx, {
			action: "delete",
			resourceType: "settings",
			resourceName: "ssh-private-key",
		});
		return true;
	}),
	updateDockerCleanup: adminProcedure
		.input(apiUpdateDockerCleanup)
		.mutation(async ({ input, ctx }) => {
			if (input.runtimeWorkerId) {
				await updateRuntimeWorkerById(input.runtimeWorkerId, {
					enableDockerCleanup: input.enableDockerCleanup,
				});

				const runtimeWorkers = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);

				if (
					runtimeWorkers.organizationId !== ctx.session?.activeOrganizationId
				) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this runtime worker",
					});
				}

				if (runtimeWorkers.enableDockerCleanup) {
					const runtimeWorkers = await findRuntimeWorkerById(
						input.runtimeWorkerId,
					);
					if (runtimeWorkers.runtimeWorkerStatus === "inactive") {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Runtime worker is inactive",
						});
					}
					scheduleJob(
						runtimeWorkers.runtimeWorkerId,
						CLEANUP_CRON_JOB,
						async () => {
							console.log(
								`Container Runtime Cleanup ${new Date().toLocaleString()}] Running...`,
							);

							await cleanupAll(runtimeWorkers.runtimeWorkerId);

							await sendDockerCleanupNotifications(
								runtimeWorkers.organizationId,
							);
						},
					);
				} else {
					const currentJob = scheduledJobs[runtimeWorkers.runtimeWorkerId];
					currentJob?.cancel();
				}
			} else {
				const settingsUpdated = await updateWebServerSettings({
					enableDockerCleanup: input.enableDockerCleanup,
				});

				if (settingsUpdated?.enableDockerCleanup) {
					scheduleJob("docker-cleanup", CLEANUP_CRON_JOB, async () => {
						console.log(
							`Container Runtime Cleanup ${new Date().toLocaleString()}] Running...`,
						);

						await cleanupAll();

						await sendDockerCleanupNotifications(
							ctx.session.activeOrganizationId,
						);
					});
				} else {
					const currentJob = scheduledJobs["docker-cleanup"];
					currentJob?.cancel();
				}
			}

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "docker-cleanup",
			});
			return true;
		}),

	updateRemoteServersOnly: adminProcedure
		.input(z.object({ remoteServersOnly: z.boolean() }))
		.mutation(async ({ input, ctx }) => {
			await updateWebServerSettings({
				remoteServersOnly: input.remoteServersOnly,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "remote-servers-only",
			});
			return true;
		}),

	updateBuildsConcurrency: adminProcedure
		.input(apiUpdateWebServerBuildsConcurrency)
		.mutation(async ({ input, ctx }) => {
			await assertBuildsConcurrencyAllowed(
				input.buildsConcurrency,
				ctx.session.activeOrganizationId,
			);

			await updateWebServerSettings({
				buildsConcurrency: input.buildsConcurrency,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "builds-concurrency",
			});
			return true;
		}),

	readTraefikConfig: adminProcedure.query(() => {
		const traefikConfig = readMainConfig();
		return traefikConfig;
	}),

	updateTraefikConfig: adminProcedure
		.input(apiTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			writeMainConfig(input.traefikConfig);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "traefik-config",
			});
			return true;
		}),

	readWebServerTraefikConfig: adminProcedure.query(() => {
		const traefikConfig = readConfig("docklands");
		return traefikConfig;
	}),
	updateWebServerTraefikConfig: adminProcedure
		.input(apiTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			writeConfig("docklands", input.traefikConfig);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "web-server-traefik-config",
			});
			return true;
		}),

	readMiddlewareTraefikConfig: adminProcedure.query(() => {
		const traefikConfig = readConfig("middlewares");
		return traefikConfig;
	}),

	updateMiddlewareTraefikConfig: adminProcedure
		.input(apiTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			writeConfig("middlewares", input.traefikConfig);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "middleware-traefik-config",
			});
			return true;
		}),
	getUpdateData: protectedProcedure.mutation(async () => {
		return await getUpdateData(packageInfo.version);
	}),
	updateServer: adminProcedure.mutation(async ({ ctx }) => {
		const data = await getUpdateData(packageInfo.version);
		if (data.updateAvailable) {
			void spawnAsync("docker", [
				"service",
				"update",
				"--force",
				"--image",
				`${DOCKLANDS_IMAGE}:${data.latestVersion}`,
				"docklands",
			]);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "docklands-version",
			});
		}

		return true;
	}),

	getDocklandsVersion: protectedProcedure.query(() => {
		return packageInfo.version;
	}),
	getReleaseTag: protectedProcedure.query(() => {
		return getDocklandsImageTag();
	}),
	readDirectories: protectedProcedure
		.input(apiRuntimeWorkerSchema)
		.query(async ({ ctx, input }) => {
			try {
				await checkPermission(ctx, { traefikFiles: ["read"] });
				const { MAIN_TRAEFIK_PATH } = paths(!!input?.runtimeWorkerId);
				const result = await readDirectory(
					MAIN_TRAEFIK_PATH,
					input?.runtimeWorkerId,
				);
				return result || [];
			} catch (error) {
				throw error;
			}
		}),

	updateTraefikFile: protectedProcedure
		.input(apiModifyTraefikConfig)
		.mutation(async ({ input, ctx }) => {
			await checkPermission(ctx, { traefikFiles: ["write"] });
			// Validate the YAML before writing — a malformed Traefik file can take
			// down all ingress. Validation is the default; power users can bypass it
			// explicitly with `skipValidation: true`.
			if (!input.skipValidation) {
				try {
					parse(input.traefikConfig);
				} catch (error) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Traefik configuration is not valid YAML: ${
							error instanceof Error ? error.message : String(error)
						}. Fix the file, or pass skipValidation to save it anyway.`,
					});
				}
			}
			await writeTraefikConfigInPath(
				input.path,
				input.traefikConfig,
				input?.runtimeWorkerId,
			);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "traefik-file",
			});
			return true;
		}),

	readTraefikFile: protectedProcedure
		.input(apiReadTraefikConfig)
		.query(async ({ input, ctx }) => {
			await checkPermission(ctx, { traefikFiles: ["read"] });

			if (input.runtimeWorkerId) {
				const runtimeWorkers = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);

				if (
					runtimeWorkers.organizationId !== ctx.session?.activeOrganizationId
				) {
					throw new TRPCError({ code: "UNAUTHORIZED" });
				}
			}

			return readConfigInPath(input.path, input.runtimeWorkerId);
		}),
	getIp: protectedProcedure.query(async () => {
		const settings = await getWebServerSettings();
		return settings?.serverIp || "";
	}),
	updateServerIp: adminProcedure
		.input(
			z.object({
				serverIp: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const settings = await updateWebServerSettings({
				serverIp: input.serverIp,
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "runtimeWorker-ip",
			});
			return settings;
		}),

	getOpenApiDocument: protectedProcedure.query(
		async ({ ctx }): Promise<unknown> => {
			const protocol = ctx.req.headers["x-forwarded-proto"];
			const url = `${protocol}://${ctx.req.headers.host}/api`;
			const openApiDocument = generateOpenApiDocument(appRouter, {
				title: "tRPC OpenAPI",
				version: packageInfo.version,
				baseUrl: url,
				docsUrl: `${url}/settings.getOpenApiDocument`,
				tags: [
					"admin",
					"docker",
					"compose",
					"registry",
					"cluster",
					"user",
					"domain",
					"destination",
					"backup",
					"deployment",
					"mounts",
					"certificates",
					"settings",
					"security",
					"redirects",
					"port",
					"workspace",
					"application",
					"mysql",
					"postgres",
					"redis",
					"mongo",
					"libsql",
					"mariadb",
					"sshRouter",
					"gitProvider",
					"bitbucket",
					"github",
					"gitlab",
					"gitea",
					"tag",
					"patch",
					"runtimeWorker",
					"volumeBackups",
					"environment",
					"organization",
					"previewDeployment",
				],
			});

			openApiDocument.info = {
				title: "Docklands API",
				description: "Endpoints for docklands",
				version: packageInfo.version,
			};

			// Add security schemes configuration
			openApiDocument.components = {
				...openApiDocument.components,
				securitySchemes: {
					apiKey: {
						type: "apiKey",
						in: "header",
						name: "x-api-key",
						description: "API key authentication",
					},
				},
			};

			// Apply security globally to all endpoints
			openApiDocument.security = [
				{
					apiKey: [],
				},
			];
			return openApiDocument;
		},
	),
	readTraefikEnv: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.query(async ({ input }) => {
			const envVars = await readEnvironmentVariables(
				"docklands-traefik",
				input?.runtimeWorkerId,
			);
			return envVars;
		}),

	writeTraefikEnv: adminProcedure
		.input(
			z.object({ env: z.string(), runtimeWorkerId: z.string().optional() }),
		)
		.mutation(async ({ input, ctx }) => {
			const envs = prepareEnvironmentVariables(input.env);
			const ports = await readPorts(
				"docklands-traefik",
				input?.runtimeWorkerId,
			);

			// Run in background so the request returns immediately; client polls /api/health.
			void writeTraefikSetup({
				env: envs,
				additionalPorts: ports,
				runtimeWorkerId: input.runtimeWorkerId,
			}).catch((err) => {
				console.error("writeTraefikEnv background writeTraefikSetup:", err);
			});
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "traefik-env",
			});
			return true;
		}),
	haveTraefikDashboardPortEnabled: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.query(async ({ input }) => {
			const ports = await readPorts(
				"docklands-traefik",
				input?.runtimeWorkerId,
			);
			return ports.some((port) => port.targetPort === 8080);
		}),

	// Raw ingress access logs (hosts, paths, client IPs, UAs) for the whole
	// deployment — at least as sensitive as the aggregated `readStats` below, so
	// gate it the same way (owner/admin) instead of any signed-in user.
	readStatsLogs: adminProcedure
		.meta({
			openapi: {
				path: "/read-stats-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiReadStatsLogs)
		.query(async ({ input }) => {
			const rawConfig = await readMonitoringConfig(
				!!input.dateRange?.start && !!input.dateRange?.end,
			);

			const parsedConfig = parseRawConfig(
				rawConfig as string,
				input.page,
				input.sort,
				input.search,
				input.status,
				input.dateRange,
			);

			return parsedConfig;
		}),
	readStats: adminProcedure
		.meta({
			openapi: {
				path: "/read-stats",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(
			z
				.object({
					dateRange: z
						.object({
							start: z.string().optional(),
							end: z.string().optional(),
						})
						.optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const rawConfig = await readMonitoringConfig(
				!!input?.dateRange?.start || !!input?.dateRange?.end,
			);
			const processedLogs = processLogs(rawConfig as string, input?.dateRange);
			return processedLogs || [];
		}),
	haveActivateRequests: protectedProcedure.query(async () => {
		const config = readMainConfig();

		if (!config) return false;
		const parsedConfig = parse(config) as {
			accessLog?: {
				filePath: string;
			};
		};

		return !!parsedConfig?.accessLog?.filePath;
	}),
	toggleRequests: adminProcedure
		.input(
			z.object({
				enable: z.boolean(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const mainConfig = readMainConfig();
			if (!mainConfig) return false;

			const currentConfig = parse(mainConfig) as {
				accessLog?: {
					filePath: string;
				};
			};

			if (input.enable) {
				const config = {
					accessLog: {
						filePath: "/etc/docklands/traefik/dynamic/access.log",
						format: "json",
						bufferingSize: 100,
					},
				};
				currentConfig.accessLog = config.accessLog;
			} else {
				currentConfig.accessLog = undefined;
			}

			writeMainConfig(stringify(currentConfig));
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "toggle-requests",
			});
			return true;
		}),
	isUserSubscribed: protectedProcedure.query(async ({ ctx }) => {
		const haveServers = await db.query.runtimeWorkers.findMany({
			where: eq(
				runtimeWorkers.organizationId,
				ctx.session?.activeOrganizationId || "",
			),
		});
		const haveProjects = await db.query.workspaces.findMany({
			where: eq(
				workspaces.organizationId,
				ctx.session?.activeOrganizationId || "",
			),
		});
		return haveServers.length > 0 || haveProjects.length > 0;
	}),
	health: publicProcedure.query(async () => {
		try {
			await db.execute(sql`SELECT 1`);
			return { status: "ok" };
		} catch (error) {
			console.error("Database connection error:", error);
			throw error;
		}
	}),
	checkInfrastructureHealth: adminProcedure.query(async () => {
		const [postgres, traefik] = await Promise.all([
			checkPostgresHealth(),
			checkTraefikHealth(),
		]);

		return { postgres, traefik };
	}),
	setupGPU: adminProcedure
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				await setupGPUSupport(input.runtimeWorkerId);
				await audit(ctx, {
					action: "update",
					resourceType: "settings",
					resourceName: "setup-gpu",
				});
				return { success: true };
			} catch (error) {
				console.error("GPU Setup Error:", error);
				throw error;
			}
		}),
	checkGPUStatus: adminProcedure
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			try {
				return await checkGPUStatus(input.runtimeWorkerId || "");
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to check GPU status";
				throw new TRPCError({
					code: "BAD_REQUEST",
					message,
				});
			}
		}),
	updateTraefikPorts: adminProcedure
		.input(
			z.object({
				runtimeWorkerId: z.string().optional(),
				additionalPorts: z.array(
					z.object({
						targetPort: z.number(),
						publishedPort: z.number(),
						protocol: z.enum(["tcp", "udp", "sctp"]),
					}),
				),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				const env = await readEnvironmentVariables(
					"docklands-traefik",
					input?.runtimeWorkerId,
				);

				for (const port of input.additionalPorts) {
					const portCheck = await checkPortInUse(
						port.publishedPort,
						input.runtimeWorkerId,
					);
					if (portCheck.isInUse) {
						throw new TRPCError({
							code: "CONFLICT",
							message: `Port ${port.targetPort} is already in use by ${portCheck.conflictingContainer}`,
						});
					}
				}
				const preparedEnv = prepareEnvironmentVariables(env);

				// Run in background so the request returns immediately; client polls /api/health.
				void writeTraefikSetup({
					env: preparedEnv,
					additionalPorts: input.additionalPorts,
					runtimeWorkerId: input.runtimeWorkerId,
				}).catch((err) => {
					console.error(
						"updateTraefikPorts background writeTraefikSetup:",
						err,
					);
				});
				await audit(ctx, {
					action: "update",
					resourceType: "settings",
					resourceName: "traefik-ports",
				});
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error updating Traefik ports",
					cause: error,
				});
			}
		}),
	getTraefikPorts: adminProcedure
		.input(apiRuntimeWorkerSchema)
		.query(async ({ input }) => {
			const ports = await readPorts(
				"docklands-traefik",
				input?.runtimeWorkerId,
			);
			return ports;
		}),
	updateLogCleanup: adminProcedure
		.input(
			z.object({
				cronExpression: z.string().nullable(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			let result: boolean;
			if (input.cronExpression) {
				result = await startLogCleanup(input.cronExpression);
			} else {
				result = await stopLogCleanup();
			}
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "log-cleanup",
			});
			return result;
		}),

	getLogCleanupStatus: protectedProcedure.query(async () => {
		return getLogCleanupStatus();
	}),
});
