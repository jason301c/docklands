import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateMount,
	apiFindMountByApplicationId,
	apiFindOneMount,
	apiRemoveMount,
	apiUpdateMount,
} from "@/server/core/db/schema";
import type { ServiceType } from "@/server/core/db/schema/mount";
import { findApplicationById } from "@/server/core/services/application";
import { findComposeById } from "@/server/core/services/compose";
import { findDatabaseById } from "@/server/core/services/database";
import {
	createMount,
	deleteMount,
	findMountById,
	findMountsByApplicationId,
	updateMount,
} from "@/server/core/services/mount";
import {
	checkServiceAccess,
	checkServicePermissionAndAccess,
} from "@/server/core/services/permission";
import { getServiceContainer } from "@/server/core/utils/docker/utils";
import { createTRPCRouter, protectedProcedure } from "../trpc";

async function getServiceOrganizationId(
	serviceId: string,
	serviceType: ServiceType,
): Promise<string | null> {
	switch (serviceType) {
		case "application": {
			const app = await findApplicationById(serviceId);
			return app?.environment?.workspace?.organizationId ?? null;
		}
		case "compose": {
			const compose = await findComposeById(serviceId);
			return compose?.environment?.workspace?.organizationId ?? null;
		}
		default: {
			// all managed database engines resolve to the unified database table
			const database = await findDatabaseById(serviceId);
			return database?.environment?.workspace?.organizationId ?? null;
		}
	}
}

export const mountRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateMount)
		.mutation(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.serviceId, {
				volume: ["create"],
			});
			const mount = await createMount(input);
			await audit(ctx, {
				action: "create",
				resourceType: "mount",
				resourceId: mount.mountId,
				resourceName: input.mountPath,
			});
			return mount;
		}),
	remove: protectedProcedure
		.input(apiRemoveMount)
		.mutation(async ({ input, ctx }) => {
			const mount = await findMountById(input.mountId);
			const serviceId =
				mount.applicationId || mount.databaseId || mount.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volume: ["delete"],
				});
			}
			await audit(ctx, {
				action: "delete",
				resourceType: "mount",
				resourceId: input.mountId,
			});
			return await deleteMount(input.mountId);
		}),

	one: protectedProcedure
		.input(apiFindOneMount)
		.query(async ({ input, ctx }) => {
			const mount = await findMountById(input.mountId);
			const serviceId =
				mount.applicationId || mount.databaseId || mount.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volume: ["read"],
				});
			}
			return mount;
		}),
	update: protectedProcedure
		.input(apiUpdateMount)
		.mutation(async ({ input, ctx }) => {
			const mount = await findMountById(input.mountId);
			const serviceId =
				mount.applicationId || mount.databaseId || mount.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					volume: ["create"],
				});
			}
			await audit(ctx, {
				action: "update",
				resourceType: "mount",
				resourceId: input.mountId,
				resourceName: input.mountPath,
			});
			return await updateMount(input.mountId, input);
		}),
	allNamedByApplicationId: protectedProcedure
		.input(z.object({ applicationId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				volume: ["read"],
			});
			const app = await findApplicationById(input.applicationId);
			const container = await getServiceContainer(
				app.appName,
				app.runtimeWorkerId,
			);
			const mounts = container?.Mounts.filter(
				(mount) => mount.Type === "volume" && mount.Source !== "",
			);
			return mounts;
		}),
	listByServiceId: protectedProcedure
		.input(apiFindMountByApplicationId)
		.query(async ({ input, ctx }) => {
			await checkServiceAccess(ctx, input.serviceId, "read");
			const organizationId = await getServiceOrganizationId(
				input.serviceId,
				input.serviceType,
			);
			if (
				organizationId === null ||
				organizationId !== ctx.session.activeOrganizationId
			) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message:
						"You are not authorized to access this service or it does not exist",
				});
			}
			return await findMountsByApplicationId(
				input.serviceId,
				input.serviceType,
			);
		}),
});
