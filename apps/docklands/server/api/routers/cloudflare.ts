import { createTRPCRouter, withPermission } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { apiConnectCloudflare } from "@/server/core/db/schema";
import {
	type CloudflareIntegration,
	connectCloudflare,
	disconnectCloudflare,
	getCloudflareIntegration,
	refreshCloudflareZones,
} from "@/server/core/services/cloudflare";

/**
 * Never expose the stored API token to the client. The integration is only ever
 * returned through this projection.
 */
const sanitize = (integration: CloudflareIntegration | null) =>
	integration
		? {
				connected: true as const,
				accountId: integration.accountId,
				accountName: integration.accountName,
				zones: integration.zones,
				createdAt: integration.createdAt,
			}
		: { connected: false as const };

export const cloudflareRouter = createTRPCRouter({
	get: withPermission("tunnel", "read").query(async () => {
		return sanitize(await getCloudflareIntegration());
	}),

	connect: withPermission("tunnel", "create")
		.input(apiConnectCloudflare)
		.mutation(async ({ input, ctx }) => {
			const integration = await connectCloudflare(input.apiToken);
			await audit(ctx, {
				action: "create",
				resourceType: "cloudflare",
				resourceId: integration.id,
				resourceName: integration.accountName ?? "Cloudflare",
			});
			return sanitize(integration);
		}),

	refreshZones: withPermission("tunnel", "read").mutation(async () => {
		return await refreshCloudflareZones();
	}),

	disconnect: withPermission("tunnel", "delete").mutation(async ({ ctx }) => {
		await disconnectCloudflare();
		await audit(ctx, {
			action: "delete",
			resourceType: "cloudflare",
			resourceName: "Cloudflare",
		});
		return { connected: false as const };
	}),
});
