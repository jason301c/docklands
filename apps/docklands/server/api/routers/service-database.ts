import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { checkServiceAccess } from "@/server/core/services/permission";
import {
	findServiceDatabaseById,
	findServiceDatabasesByComposeId,
	getServiceDatabaseConnectionVars,
	serviceDatabaseSupportsBackup,
} from "@/server/core/services/service-database";

export const serviceDatabaseRouter = createTRPCRouter({
	/** Databases detected inside a compose stack (the template bridge). */
	byCompose: protectedProcedure
		.input(z.object({ composeId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.composeId, "read");
			const databases = await findServiceDatabasesByComposeId(input.composeId);
			return databases.map((database) => ({
				serviceDatabaseId: database.serviceDatabaseId,
				serviceName: database.serviceName,
				engine: database.engine,
				image: database.image,
				supportsBackup: serviceDatabaseSupportsBackup(database),
			}));
		}),
	/** Read-only connection variables for a compose-embedded database. */
	connectionInfo: protectedProcedure
		.input(z.object({ serviceDatabaseId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			const database = await findServiceDatabaseById(input.serviceDatabaseId);
			await checkServiceAccess(ctx, database.composeId, "read");
			return {
				serviceName: database.serviceName,
				engine: database.engine,
				supportsBackup: serviceDatabaseSupportsBackup(database),
				connectionVariables: getServiceDatabaseConnectionVars(database),
			};
		}),
});
