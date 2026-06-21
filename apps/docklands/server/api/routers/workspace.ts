import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	apiCreateWorkspaceConnection,
	apiFindWorkspace,
	apiRemoveWorkspaceConnection,
	apiUpdateWorkspaceNode,
	apiUpdateWorkspaceServiceEnv,
	apiWorkspaceConnectionVariables,
	apiWorkspaceServiceEnv,
} from "@/server/core/db/schema";
import { findEnvironmentById } from "@/server/core/services/environment";
import {
	checkEnvironmentAccess,
	checkPermission,
	findMemberByUserId,
} from "@/server/core/services/permission";
import {
	applyWorkspaceConnectionVariables,
	assertWorkspaceServiceExists,
	createWorkspaceConnection,
	findWorkspaceConnectionById,
	getEnvironmentWorkspace,
	getWorkspaceConnectionVariableEntries,
	readWorkspaceServiceEnv,
	removeWorkspaceConnection,
	updateWorkspaceServiceEnv,
	upsertWorkspaceNode,
} from "@/server/core/services/workspace";

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
	if (environment.project.organizationId !== organizationId) {
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

	if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
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
			libsql: environment.libsql.filter((service) =>
				accessedServices.includes(service.libsqlId),
			),
			mariadb: environment.mariadb.filter((service) =>
				accessedServices.includes(service.mariadbId),
			),
			mongo: environment.mongo.filter((service) =>
				accessedServices.includes(service.mongoId),
			),
			mysql: environment.mysql.filter((service) =>
				accessedServices.includes(service.mysqlId),
			),
			postgres: environment.postgres.filter((service) =>
				accessedServices.includes(service.postgresId),
			),
			redis: environment.redis.filter((service) =>
				accessedServices.includes(service.redisId),
			),
		};
	}

	return environment;
};

export const workspaceRouter = createTRPCRouter({
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

	serviceEnv: protectedProcedure
		.input(apiWorkspaceServiceEnv)
		.query(async ({ input, ctx }) => {
			await checkPermission(ctx, { envVars: ["read"] });
			const environment = await getAuthorizedEnvironment(
				ctx,
				input.environmentId,
			);
			assertWorkspaceServiceExists(
				environment,
				input.serviceType,
				input.serviceId,
			);

			const service = await readWorkspaceServiceEnv(input);
			if (!service) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Service not found",
				});
			}

			return {
				env: service.env ?? "",
			};
		}),

	updateServiceEnv: protectedProcedure
		.input(apiUpdateWorkspaceServiceEnv)
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

			await updateWorkspaceServiceEnv(input);
			return {
				env: input.env,
			};
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
});
