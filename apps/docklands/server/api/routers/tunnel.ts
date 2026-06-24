import { z } from "zod";
import { createTRPCRouter, withPermission } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import { apiProvisionTunnel } from "@/server/core/db/schema";
import {
	getTunnel,
	provisionTunnel,
	type Tunnel,
	teardownTunnel,
} from "@/server/core/services/tunnel";

/** Never expose the cloudflared run token to the client. */
const sanitize = (tunnel: Tunnel | null) =>
	tunnel
		? {
				tunnelId: tunnel.tunnelId,
				name: tunnel.name,
				cfTunnelId: tunnel.cfTunnelId,
				runtimeWorkerId: tunnel.runtimeWorkerId,
				status: tunnel.status,
				createdAt: tunnel.createdAt,
			}
		: null;

export const tunnelRouter = createTRPCRouter({
	get: withPermission("tunnel", "read").query(async () => {
		return sanitize(await getTunnel());
	}),

	provision: withPermission("tunnel", "create")
		.input(apiProvisionTunnel)
		.mutation(async ({ input, ctx }) => {
			const tunnel = await provisionTunnel(input);
			await audit(ctx, {
				action: "create",
				resourceType: "tunnel",
				resourceId: tunnel.tunnelId,
				resourceName: tunnel.name,
			});
			return sanitize(tunnel);
		}),

	teardown: withPermission("tunnel", "delete")
		.input(z.object({ tunnelId: z.string().optional() }))
		.mutation(async ({ input, ctx }) => {
			await teardownTunnel(input.tunnelId);
			await audit(ctx, {
				action: "delete",
				resourceType: "tunnel",
				resourceName: "Cloudflare Tunnel",
			});
			return { success: true as const };
		}),
});
