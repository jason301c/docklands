import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	apiCreateWorkspaceConnection,
	apiFindWorkspace,
	apiRemoveWorkspaceConnection,
	apiUpdateWorkspaceNode,
	apiWorkspaceConnectionVariables,
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
	removeWorkspaceConnection,
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

			return createWorkspaceConnection({
				environmentId: input.environmentId,
				sourceServiceType: input.source.serviceType,
				sourceServiceId: input.source.serviceId,
				targetServiceType: input.target.serviceType,
				targetServiceId: input.target.serviceId,
				label: input.label,
			});
		}),

	removeConnection: protectedProcedure
		.input(apiRemoveWorkspaceConnection)
		.mutation(async ({ input, ctx }) => {
			const connection = await findWorkspaceConnectionById(input.connectionId);
			await getAuthorizedEnvironment(ctx, connection.environmentId);
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
