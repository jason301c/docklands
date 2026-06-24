import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiAssignWorkspaceServiceGroup,
	apiCreateWorkspaceConnection,
	apiCreateWorkspaceGroup,
	apiFindWorkspace,
	apiRemoveWorkspaceConnection,
	apiRemoveWorkspaceGroup,
	apiSyncWorkspaceServiceConnectionVariables,
	apiUpdateWorkspaceGroup,
	apiUpdateWorkspaceNode,
	apiWorkspaceConnectionVariables,
} from "@/server/core/db/schema";
import { findEnvironmentById } from "@/server/core/services/environment";
import {
	checkEnvironmentAccess,
	checkPermission,
	findMemberByUserId,
	isOwnerOrAdmin,
} from "@/server/core/services/permission";
import {
	applyWorkspaceConnectionVariables,
	assertWorkspaceServiceExists,
	createWorkspaceConnection,
	findWorkspaceConnectionById,
	getEnvironmentWorkspace,
	getWorkspaceConnectionVariableEntries,
	removeWorkspaceConnection,
	syncWorkspaceConnectionVariablesForService,
	upsertWorkspaceNode,
} from "@/server/core/services/workspace-graph";
import {
	assignWorkspaceServiceGroup,
	createWorkspaceGroup,
	findWorkspaceGroupById,
	removeWorkspaceGroup,
	updateWorkspaceGroup,
} from "@/server/core/services/workspace-group";

type WorkspaceProcedureContext = {
	user: {
		id: string;
		role: "member" | "admin" | "owner";
	};
	session: {
		activeOrganizationId: string;
	};
};

const assertEnvironmentBelongsToActiveOrganization = (
	environment: Awaited<ReturnType<typeof findEnvironmentById>>,
	organizationId: string,
) => {
	if (environment.workspace.organizationId !== organizationId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not allowed to access this environment",
		});
	}
};

const getAuthorizedEnvironment = async (
	ctx: WorkspaceProcedureContext,
	environmentId: string,
) => {
	await checkEnvironmentAccess(ctx, environmentId, "read");
	const environment = await findEnvironmentById(environmentId);
	assertEnvironmentBelongsToActiveOrganization(
		environment,
		ctx.session.activeOrganizationId,
	);

	if (!isOwnerOrAdmin(ctx.user.role)) {
		const { accessedServices } = await findMemberByUserId(
			ctx.user.id,
			ctx.session.activeOrganizationId,
		);

		return {
			...environment,
			applications: environment.applications.filter((service) =>
				accessedServices.includes(service.applicationId),
			),
			compose: environment.compose.filter((service) =>
				accessedServices.includes(service.composeId),
			),
			database: environment.database.filter((service) =>
				accessedServices.includes(service.databaseId),
			),
		};
	}

	return environment;
};

export const workspaceGraphRouter = createTRPCRouter({
	byEnvironment: protectedProcedure
		.input(apiFindWorkspace)
		.query(async ({ input, ctx }) => {
			const environment = await getAuthorizedEnvironment(
				ctx,
				input.environmentId,
			);
			return getEnvironmentWorkspace(environment);
		}),

	updateNode: protectedProcedure
		.input(apiUpdateWorkspaceNode)
		.mutation(async ({ input, ctx }) => {
			const environment = await getAuthorizedEnvironment(
				ctx,
				input.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				input.serviceType,
				input.serviceId,
			);

			return upsertWorkspaceNode(input);
		}),

	connect: protectedProcedure
		.input(apiCreateWorkspaceConnection)
		.mutation(async ({ input, ctx }) => {
			const environment = await getAuthorizedEnvironment(
				ctx,
				input.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				input.source.serviceType,
				input.source.serviceId,
			);
			assertWorkspaceServiceExists(
				environment,
				input.target.serviceType,
				input.target.serviceId,
			);

			if (input.applyVariables) {
				await checkPermission(ctx, { envVars: ["write"] });
			}

			const connection = await createWorkspaceConnection({
				environmentId: input.environmentId,
				sourceServiceType: input.source.serviceType,
				sourceServiceId: input.source.serviceId,
				targetServiceType: input.target.serviceType,
				targetServiceId: input.target.serviceId,
				label: input.label,
			});

			if (!input.applyVariables) {
				return {
					connection,
					variablesApplied: 0,
					variableKeys: [],
				};
			}

			const entries = await getWorkspaceConnectionVariableEntries(connection);
			if (entries.length === 0) {
				return {
					connection,
					variablesApplied: 0,
					variableKeys: [],
				};
			}

			const result = await applyWorkspaceConnectionVariables(connection);
			return {
				connection,
				variablesApplied: result.entries.length,
				variableKeys: result.entries.map(({ key }) => key),
			};
		}),

	removeConnection: protectedProcedure
		.input(apiRemoveWorkspaceConnection)
		.mutation(async ({ input, ctx }) => {
			const connection = await findWorkspaceConnectionById(input.connectionId);
			const environment = await getAuthorizedEnvironment(
				ctx,
				connection.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				connection.sourceServiceType,
				connection.sourceServiceId,
			);
			assertWorkspaceServiceExists(
				environment,
				connection.targetServiceType,
				connection.targetServiceId,
			);
			return removeWorkspaceConnection(input.connectionId);
		}),

	connectionVariables: protectedProcedure
		.input(apiWorkspaceConnectionVariables)
		.query(async ({ input, ctx }) => {
			await checkPermission(ctx, { envVars: ["read"] });
			const connection = await findWorkspaceConnectionById(input.connectionId);
			const environment = await getAuthorizedEnvironment(
				ctx,
				connection.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				connection.sourceServiceType,
				connection.sourceServiceId,
			);
			assertWorkspaceServiceExists(
				environment,
				connection.targetServiceType,
				connection.targetServiceId,
			);

			const entries = await getWorkspaceConnectionVariableEntries(connection);
			return entries.map(({ key }) => ({ key }));
		}),

	applyConnectionVariables: protectedProcedure
		.input(apiWorkspaceConnectionVariables)
		.mutation(async ({ input, ctx }) => {
			await checkPermission(ctx, { envVars: ["write"] });
			const connection = await findWorkspaceConnectionById(input.connectionId);
			const environment = await getAuthorizedEnvironment(
				ctx,
				connection.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				connection.sourceServiceType,
				connection.sourceServiceId,
			);
			assertWorkspaceServiceExists(
				environment,
				connection.targetServiceType,
				connection.targetServiceId,
			);

			return applyWorkspaceConnectionVariables(connection);
		}),

	syncServiceConnectionVariables: protectedProcedure
		.input(apiSyncWorkspaceServiceConnectionVariables)
		.mutation(async ({ input, ctx }) => {
			await checkPermission(ctx, { envVars: ["write"] });
			const environment = await getAuthorizedEnvironment(
				ctx,
				input.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				input.serviceType,
				input.serviceId,
			);

			return syncWorkspaceConnectionVariablesForService(input);
		}),

	createGroup: protectedProcedure
		.input(apiCreateWorkspaceGroup)
		.mutation(async ({ input, ctx }) => {
			await checkEnvironmentAccess(ctx, input.environmentId, "create");
			const environment = await findEnvironmentById(input.environmentId);
			assertEnvironmentBelongsToActiveOrganization(
				environment,
				ctx.session.activeOrganizationId,
			);

			const group = await createWorkspaceGroup(input);

			await audit(ctx, {
				action: "create",
				// Groups are environment-scoped canvas layout metadata; the audit
				// log has no dedicated "group" resource type, so they record under
				// the owning environment.
				resourceType: "environment",
				resourceId: group.groupId,
				resourceName: group.name,
				metadata: {
					environmentId: input.environmentId,
					kind: "workspaceGroup",
				},
			});

			return group;
		}),

	updateGroup: protectedProcedure
		.input(apiUpdateWorkspaceGroup)
		.mutation(async ({ input, ctx }) => {
			const group = await findWorkspaceGroupById(input.groupId);
			// Reuse the read gate to verify the group's environment is in this org
			// and the caller can access it before mutating.
			await getAuthorizedEnvironment(ctx, group.environmentId);

			const updated = await updateWorkspaceGroup(input);

			// A drag/resize sends only x/y/width/height; only audit deliberate
			// rename/recolor edits to keep the log meaningful (not every nudge).
			if (input.name !== undefined || input.color !== undefined) {
				await audit(ctx, {
					action: "update",
					resourceType: "environment",
					resourceId: updated.groupId,
					resourceName: updated.name,
					metadata: {
						environmentId: group.environmentId,
						kind: "workspaceGroup",
					},
				});
			}

			return updated;
		}),

	removeGroup: protectedProcedure
		.input(apiRemoveWorkspaceGroup)
		.mutation(async ({ input, ctx }) => {
			const group = await findWorkspaceGroupById(input.groupId);
			await getAuthorizedEnvironment(ctx, group.environmentId);

			const removed = await removeWorkspaceGroup(input.groupId);

			await audit(ctx, {
				action: "delete",
				resourceType: "environment",
				resourceId: group.groupId,
				resourceName: group.name,
				metadata: {
					environmentId: group.environmentId,
					kind: "workspaceGroup",
				},
			});

			return removed;
		}),

	assignServiceGroup: protectedProcedure
		.input(apiAssignWorkspaceServiceGroup)
		.mutation(async ({ input, ctx }) => {
			const environment = await getAuthorizedEnvironment(
				ctx,
				input.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				input.serviceType,
				input.serviceId,
			);

			// Reject membership in a group that belongs to another environment.
			if (input.groupId) {
				const group = await findWorkspaceGroupById(input.groupId);
				if (group.environmentId !== input.environmentId) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Group does not belong to this environment",
					});
				}
			}

			return assignWorkspaceServiceGroup({
				environmentId: input.environmentId,
				serviceType: input.serviceType,
				serviceId: input.serviceId,
				groupId: input.groupId,
			});
		}),
});
