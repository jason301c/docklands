import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { db } from "@/server/core/db";
import {
	apiCreateWorkspace,
	apiFindOneWorkspace,
	apiRemoveWorkspace,
	apiUpdateWorkspace,
	applications,
	compose,
	database,
	environments,
	workspaces,
} from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import {
	createApplication,
	findApplicationById,
} from "@/server/core/services/application";
import { createBackup } from "@/server/core/services/backup";
import { createCompose, findComposeById } from "@/server/core/services/compose";
import {
	createDatabase,
	findDatabaseById,
} from "@/server/core/services/database";
import { createDomain } from "@/server/core/services/domain";
import { findEnvironmentById } from "@/server/core/services/environment";
import { createDatabaseMount, createMount } from "@/server/core/services/mount";
import {
	addNewEnvironment,
	addNewWorkspace,
	checkPermission,
	checkWorkspaceAccess,
	findMemberByUserId,
	isOwnerOrAdmin,
} from "@/server/core/services/permission";
import { createPort } from "@/server/core/services/port";
import { createPreviewDeployment } from "@/server/core/services/preview-deployment";
import { createRedirect } from "@/server/core/services/redirect";
import { createSecurity } from "@/server/core/services/security";
import {
	createWorkspace,
	deleteWorkspace,
	findWorkspaceById,
	updateWorkspaceById,
} from "@/server/core/services/workspace";

const logger = createLogger("workspace-router");

export const workspaceRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateWorkspace)
		.mutation(async ({ ctx, input }) => {
			try {
				await checkWorkspaceAccess(ctx, "create");

				const workspace = await createWorkspace(
					input,
					ctx.session.activeOrganizationId,
				);
				await addNewWorkspace(ctx, workspace.workspace.workspaceId);

				await addNewEnvironment(
					ctx,
					workspace?.environment?.environmentId || "",
				);

				await audit(ctx, {
					action: "create",
					resourceType: "workspace",
					resourceId: workspace.workspace.workspaceId,
					resourceName: workspace.workspace.name,
				});
				return workspace;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error creating the workspace: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),

	one: protectedProcedure
		.input(apiFindOneWorkspace)
		.query(async ({ input, ctx }) => {
			if (!isOwnerOrAdmin(ctx.user.role)) {
				const { accessedServices, accessedWorkspaces } =
					await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);

				if (!accessedWorkspaces.includes(input.workspaceId)) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You don't have access to this workspace",
					});
				}

				const workspace = await db.query.workspaces.findFirst({
					where: and(
						eq(workspaces.workspaceId, input.workspaceId),
						eq(workspaces.organizationId, ctx.session.activeOrganizationId),
					),
					with: {
						environments: {
							with: {
								applications: {
									where: buildServiceFilter(
										applications.applicationId,
										accessedServices,
									),
								},
								compose: {
									where: buildServiceFilter(
										compose.composeId,
										accessedServices,
									),
								},
								database: {
									where: buildServiceFilter(
										database.databaseId,
										accessedServices,
									),
								},
							},
						},
						workspaceTags: {
							with: {
								tag: true,
							},
						},
					},
				});

				if (!workspace) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Workspace not found",
					});
				}
				return workspace;
			}
			const workspace = await findWorkspaceById(input.workspaceId);

			if (workspace.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this workspace",
				});
			}
			return workspace;
		}),
	all: protectedProcedure.query(async ({ ctx }) => {
		if (!isOwnerOrAdmin(ctx.user.role)) {
			const { accessedWorkspaces, accessedEnvironments, accessedServices } =
				await findMemberByUserId(ctx.user.id, ctx.session.activeOrganizationId);

			if (accessedWorkspaces.length === 0) {
				return [];
			}

			const environmentFilter =
				accessedEnvironments.length === 0
					? sql`false`
					: sql`${environments.environmentId} IN (${sql.join(
							accessedEnvironments.map((envId) => sql`${envId}`),
							sql`, `,
						)})`;

			return await db.query.workspaces.findMany({
				where: and(
					sql`${workspaces.workspaceId} IN (${sql.join(
						accessedWorkspaces.map((workspaceId) => sql`${workspaceId}`),
						sql`, `,
					)})`,
					eq(workspaces.organizationId, ctx.session.activeOrganizationId),
				),
				with: {
					environments: {
						where: environmentFilter,
						with: {
							applications: {
								where: buildServiceFilter(
									applications.applicationId,
									accessedServices,
								),
								columns: {
									applicationId: true,
									name: true,
									applicationStatus: true,
								},
							},
							database: {
								where: buildServiceFilter(
									database.databaseId,
									accessedServices,
								),
								columns: {
									databaseId: true,
									engine: true,
									name: true,
									applicationStatus: true,
								},
							},
							compose: {
								where: buildServiceFilter(compose.composeId, accessedServices),
								columns: {
									composeId: true,
									name: true,
									composeStatus: true,
								},
							},
						},
						columns: {
							environmentId: true,
							isDefault: true,
							name: true,
						},
					},
					workspaceTags: {
						with: {
							tag: true,
						},
					},
				},
				orderBy: desc(workspaces.createdAt),
			});
		}

		return await db.query.workspaces.findMany({
			with: {
				environments: {
					with: {
						applications: {
							columns: {
								applicationId: true,
								name: true,
								applicationStatus: true,
							},
						},
						database: {
							columns: {
								databaseId: true,
								engine: true,
								name: true,
								applicationStatus: true,
							},
						},
						compose: {
							columns: {
								composeId: true,
								name: true,
								composeStatus: true,
							},
						},
					},
					columns: {
						name: true,
						environmentId: true,
						isDefault: true,
					},
				},
				workspaceTags: {
					with: {
						tag: true,
					},
				},
			},
			where: eq(workspaces.organizationId, ctx.session.activeOrganizationId),
			orderBy: desc(workspaces.createdAt),
		});
	}),

	allForPermissions: withPermission("member", "update").query(
		async ({ ctx }) => {
			return await db.query.workspaces.findMany({
				where: eq(workspaces.organizationId, ctx.session.activeOrganizationId),
				orderBy: desc(workspaces.createdAt),
				columns: {
					workspaceId: true,
					name: true,
				},
				with: {
					environments: {
						columns: {
							environmentId: true,
							name: true,
							isDefault: true,
						},
						with: {
							applications: {
								columns: {
									applicationId: true,
									appName: true,
									name: true,
									createdAt: true,
									applicationStatus: true,
									description: true,
									runtimeWorkerId: true,
								},
							},
							database: {
								columns: {
									databaseId: true,
									engine: true,
									appName: true,
									name: true,
									createdAt: true,
									applicationStatus: true,
									description: true,
									runtimeWorkerId: true,
								},
							},
							compose: {
								columns: {
									composeId: true,
									appName: true,
									name: true,
									createdAt: true,
									composeStatus: true,
									description: true,
									runtimeWorkerId: true,
								},
							},
						},
					},
				},
			});
		},
	),

	homeStats: protectedProcedure.query(async ({ ctx }) => {
		const isPrivileged = isOwnerOrAdmin(ctx.user.role);

		let accessedWorkspaces: string[] = [];
		let accessedEnvironments: string[] = [];
		let accessedServices: string[] = [];

		if (!isPrivileged) {
			const member = await findMemberByUserId(
				ctx.user.id,
				ctx.session.activeOrganizationId,
			);
			accessedWorkspaces = member.accessedWorkspaces;
			accessedEnvironments = member.accessedEnvironments;
			accessedServices = member.accessedServices;

			if (accessedWorkspaces.length === 0) {
				return {
					workspaces: 0,
					environments: 0,
					applications: 0,
					compose: 0,
					databases: 0,
					services: 0,
					status: { running: 0, error: 0, idle: 0 },
				};
			}
		}

		const workspaceFilter = isPrivileged
			? eq(workspaces.organizationId, ctx.session.activeOrganizationId)
			: and(
					sql`${workspaces.workspaceId} IN (${sql.join(
						accessedWorkspaces.map((id) => sql`${id}`),
						sql`, `,
					)})`,
					eq(workspaces.organizationId, ctx.session.activeOrganizationId),
				);

		const environmentFilter = isPrivileged
			? undefined
			: accessedEnvironments.length === 0
				? sql`false`
				: sql`${environments.environmentId} IN (${sql.join(
						accessedEnvironments.map((envId) => sql`${envId}`),
						sql`, `,
					)})`;

		const applyFilter = (col: AnyPgColumn) =>
			isPrivileged ? undefined : buildServiceFilter(col, accessedServices);

		const rows = await db.query.workspaces.findMany({
			where: workspaceFilter,
			columns: { workspaceId: true },
			with: {
				environments: {
					where: environmentFilter,
					columns: { environmentId: true },
					with: {
						applications: {
							where: applyFilter(applications.applicationId),
							columns: { applicationStatus: true },
						},
						compose: {
							where: applyFilter(compose.composeId),
							columns: { composeStatus: true },
						},
						database: {
							where: applyFilter(database.databaseId),
							columns: { applicationStatus: true },
						},
					},
				},
			},
		});

		let applicationsCount = 0;
		let composeCount = 0;
		let databasesCount = 0;
		let environmentsCount = 0;
		const status = { running: 0, error: 0, idle: 0 };
		const bump = (s?: string | null) => {
			if (s === "done") status.running++;
			else if (s === "error") status.error++;
			else status.idle++;
		};

		for (const workspace of rows) {
			for (const env of workspace.environments) {
				environmentsCount++;
				applicationsCount += env.applications.length;
				composeCount += env.compose.length;
				databasesCount += env.database.length;

				for (const a of env.applications) bump(a.applicationStatus);
				for (const c of env.compose) bump(c.composeStatus);
				for (const s of env.database) bump(s.applicationStatus);
			}
		}

		return {
			workspaces: rows.length,
			environments: environmentsCount,
			applications: applicationsCount,
			compose: composeCount,
			databases: databasesCount,
			services: applicationsCount + composeCount + databasesCount,
			status,
		};
	}),

	search: protectedProcedure
		.input(
			z.object({
				q: z.string().optional(),
				name: z.string().optional(),
				description: z.string().optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const baseConditions = [
				eq(workspaces.organizationId, ctx.session.activeOrganizationId),
			];

			if (input.q?.trim()) {
				const term = `%${input.q.trim()}%`;
				baseConditions.push(
					or(
						ilike(workspaces.name, term),
						ilike(workspaces.description ?? "", term),
					)!,
				);
			}

			if (input.name?.trim()) {
				baseConditions.push(ilike(workspaces.name, `%${input.name.trim()}%`));
			}
			if (input.description?.trim()) {
				baseConditions.push(
					ilike(workspaces.description ?? "", `%${input.description.trim()}%`),
				);
			}

			if (!isOwnerOrAdmin(ctx.user.role)) {
				const { accessedWorkspaces } = await findMemberByUserId(
					ctx.user.id,
					ctx.session.activeOrganizationId,
				);
				if (accessedWorkspaces.length === 0) return { items: [], total: 0 };
				baseConditions.push(
					sql`${workspaces.workspaceId} IN (${sql.join(
						accessedWorkspaces.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				);
			}

			const where = and(...baseConditions);

			const [items, countResult] = await Promise.all([
				db.query.workspaces.findMany({
					where,
					limit: input.limit,
					offset: input.offset,
					orderBy: desc(workspaces.createdAt),
					columns: {
						workspaceId: true,
						name: true,
						description: true,
						createdAt: true,
						organizationId: true,
						env: true,
					},
				}),
				db
					.select({ count: sql<number>`count(*)::int` })
					.from(workspaces)
					.where(where),
			]);

			return {
				items,
				total: countResult[0]?.count ?? 0,
			};
		}),

	remove: protectedProcedure
		.input(apiRemoveWorkspace)
		.mutation(async ({ input, ctx }) => {
			try {
				const currentWorkspace = await findWorkspaceById(input.workspaceId);
				if (
					currentWorkspace.organizationId !== ctx.session.activeOrganizationId
				) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to delete this workspace",
					});
				}
				await checkWorkspaceAccess(ctx, "delete", input.workspaceId);
				const deletedWorkspace = await deleteWorkspace(input.workspaceId);

				await audit(ctx, {
					action: "delete",
					resourceType: "workspace",
					resourceId: currentWorkspace.workspaceId,
					resourceName: currentWorkspace.name,
				});
				return deletedWorkspace;
			} catch (error) {
				throw error;
			}
		}),
	update: protectedProcedure
		.input(apiUpdateWorkspace)
		.mutation(async ({ input, ctx }) => {
			try {
				const currentWorkspace = await findWorkspaceById(input.workspaceId);
				if (
					currentWorkspace.organizationId !== ctx.session.activeOrganizationId
				) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to update this workspace",
					});
				}

				if (!isOwnerOrAdmin(ctx.user.role)) {
					const { accessedWorkspaces } = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);
					if (!accessedWorkspaces.includes(input.workspaceId)) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this workspace",
						});
					}
				}

				if (input.env !== undefined) {
					await checkPermission(ctx, { workspaceEnvVars: ["write"] });
				}

				const workspace = await updateWorkspaceById(input.workspaceId, {
					...input,
				});

				if (workspace) {
					await audit(ctx, {
						action: "update",
						resourceType: "workspace",
						resourceId: input.workspaceId,
						resourceName: workspace.name,
					});
				}
				return workspace;
			} catch (error) {
				throw error;
			}
		}),
	duplicate: protectedProcedure
		.input(
			z.object({
				sourceEnvironmentId: z.string(),
				name: z.string(),
				description: z.string().optional(),
				includeServices: z.boolean().default(true),
				selectedServices: z
					.array(
						z.object({
							id: z.string(),
							type: z.enum([
								"application",
								"compose",
								"libsql",
								"mariadb",
								"mongo",
								"mysql",
								"postgres",
								"redis",
							]),
						}),
					)
					.optional(),
				duplicateInSameProject: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Tracks a newly created target workspace so a mid-duplication failure
			// can roll it back instead of leaving an orphaned, half-built project.
			let createdWorkspaceId: string | undefined;
			try {
				await checkWorkspaceAccess(ctx, "create");

				const sourceEnvironment = input.duplicateInSameProject
					? await findEnvironmentById(input.sourceEnvironmentId)
					: null;

				if (
					input.duplicateInSameProject &&
					sourceEnvironment?.workspace.organizationId !==
						ctx.session.activeOrganizationId
				) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this workspace",
					});
				}

				if (
					input.duplicateInSameProject &&
					sourceEnvironment &&
					!isOwnerOrAdmin(ctx.user.role)
				) {
					const { accessedWorkspaces } = await findMemberByUserId(
						ctx.user.id,
						ctx.session.activeOrganizationId,
					);
					if (
						!accessedWorkspaces.includes(
							sourceEnvironment.workspace.workspaceId,
						)
					) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "You don't have access to this workspace",
						});
					}
				}

				const targetProject = input.duplicateInSameProject
					? sourceEnvironment
					: await createWorkspace(
							{
								name: input.name,
								description: input.description,
								env: sourceEnvironment?.workspace.env,
							},
							ctx.session.activeOrganizationId,
						).then((value) => value.environment);

				if (!input.duplicateInSameProject) {
					createdWorkspaceId = targetProject?.workspaceId;
				}

				if (input.includeServices) {
					const servicesToDuplicate = input.selectedServices || [];

					const duplicateService = async (id: string, type: string) => {
						switch (type) {
							case "application": {
								const {
									applicationId,
									domains,
									security,
									ports,
									registry,
									redirects,
									previewDeployments,
									mounts,
									appName,
									refreshToken,
									...application
								} = await findApplicationById(id);
								const newAppName = appName.substring(
									0,
									appName.lastIndexOf("-"),
								);

								const newApplication = await createApplication({
									...application,
									appName: newAppName,
									name: input.duplicateInSameProject
										? `${application.name} (copy)`
										: application.name,
									environmentId: targetProject?.environmentId || "",
								});

								for (const domain of domains) {
									// Drop the tunnel linkage when copying: a duplicate can't share
									// the source's host (and therefore its CNAME), so copy the domain
									// as public — the user re-points it to a new host afterwards.
									const {
										domainId,
										cfDnsRecordId,
										tunnelId,
										ingressMode,
										...rest
									} = domain;
									await createDomain({
										...rest,
										applicationId: newApplication.applicationId,
										domainType: "application",
										ingressMode: "public",
									});
								}

								for (const port of ports) {
									const { portId, ...rest } = port;
									await createPort({
										...rest,
										applicationId: newApplication.applicationId,
									});
								}

								for (const mount of mounts) {
									const { mountId, ...rest } = mount;
									await createMount({
										...rest,
										serviceId: newApplication.applicationId,
										serviceType: "application",
									});
								}

								for (const redirect of redirects) {
									const { redirectId, ...rest } = redirect;
									await createRedirect({
										...rest,
										applicationId: newApplication.applicationId,
									});
								}

								for (const secure of security) {
									const { securityId, ...rest } = secure;
									await createSecurity({
										...rest,
										applicationId: newApplication.applicationId,
									});
								}

								for (const previewDeployment of previewDeployments) {
									const { previewDeploymentId, ...rest } = previewDeployment;
									await createPreviewDeployment({
										...rest,
										applicationId: newApplication.applicationId,
										domainId: undefined,
									});
								}

								break;
							}
							case "compose": {
								const {
									composeId,
									mounts,
									domains,
									appName,
									refreshToken,
									...compose
								} = await findComposeById(id);

								const newAppName = appName.substring(
									0,
									appName.lastIndexOf("-"),
								);

								const newCompose = await createCompose({
									...compose,
									appName: newAppName,
									name: input.duplicateInSameProject
										? `${compose.name} (copy)`
										: compose.name,
									environmentId: targetProject?.environmentId || "",
								});

								for (const mount of mounts) {
									const { mountId, ...rest } = mount;
									await createMount({
										...rest,
										serviceId: newCompose.composeId,
										serviceType: "compose",
									});
								}

								for (const domain of domains) {
									// Copy as public (see the application branch): a duplicate can't
									// reuse the source's tunnel CNAME for the same host.
									const {
										domainId,
										cfDnsRecordId,
										tunnelId,
										ingressMode,
										...rest
									} = domain;
									await createDomain({
										...rest,
										composeId: newCompose.composeId,
										domainType: "compose",
										ingressMode: "public",
									});
								}

								break;
							}
							default: {
								// all managed database engines clone through the unified database table
								const {
									databaseId: _databaseId,
									mounts,
									backups,
									appName,
									environment: _environment,
									runtimeWorker: _runtimeWorker,
									...database
								} = await findDatabaseById(id);

								const newAppName = appName.substring(
									0,
									appName.lastIndexOf("-"),
								);

								const newDatabase = await createDatabase({
									...database,
									config: database.config as Record<string, unknown>,
									appName: newAppName,
									name: input.duplicateInSameProject
										? `${database.name} (copy)`
										: database.name,
									environmentId: targetProject?.environmentId || "",
								});

								for (const mount of mounts) {
									await createDatabaseMount(newDatabase.databaseId, {
										type: mount.type,
										mountPath: mount.mountPath,
										volumeName: mount.volumeName,
										hostPath: mount.hostPath,
										filePath: mount.filePath,
										content: mount.content,
									});
								}

								for (const backup of backups) {
									const { backupId, appName: _appName, ...rest } = backup;
									await createBackup({
										...rest,
										databaseId: newDatabase.databaseId,
										// redis has no backups, so the loop never runs for it
										databaseType: newDatabase.engine as
											| "postgres"
											| "mysql"
											| "mariadb"
											| "mongo"
											| "libsql",
									});
								}
								break;
							}
						}
					};

					for (const service of servicesToDuplicate) {
						await duplicateService(service.id, service.type);
					}
				}

				if (!input.duplicateInSameProject) {
					await addNewWorkspace(ctx, targetProject?.workspaceId || "");
				}

				await audit(ctx, {
					action: "create",
					resourceType: "workspace",
					resourceId: targetProject?.workspaceId || "",
					resourceName: input.name,
					metadata: { duplicatedFrom: input.sourceEnvironmentId },
				});
				return targetProject;
			} catch (error) {
				// Roll back the half-built workspace (cascade removes its children)
				// so a failed duplication leaves no orphaned partial project.
				if (createdWorkspaceId) {
					try {
						await deleteWorkspace(createdWorkspaceId);
					} catch (cleanupError) {
						logger.error(
							{ err: cleanupError, workspaceId: createdWorkspaceId },
							"failed to roll back duplicated workspace",
						);
					}
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error duplicating the workspace: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),
});

function buildServiceFilter(
	fieldName: AnyPgColumn,
	accessedServices: string[],
) {
	return accessedServices.length === 0
		? sql`false`
		: sql`${fieldName} IN (${sql.join(
				accessedServices.map((serviceId) => sql`${serviceId}`),
				sql`, `,
			)})`;
}
