import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateMount,
	apiFindOneMount,
	apiRemoveMount,
	apiUpdateMount,
} from "@/server/core/db/schema";
import { findApplicationById } from "@/server/core/services/application";
import {
	createMount,
	deleteMount,
	findMountById,
	updateMount,
} from "@/server/core/services/mount";
import { checkServicePermissionAndAccess } from "@/server/core/services/permission";
import { getServiceContainer } from "@/server/core/utils/docker/utils";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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
});
