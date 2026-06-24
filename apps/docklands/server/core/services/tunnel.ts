import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { domains, tunnels } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import {
	startCloudflared,
	stopCloudflared,
} from "@/server/core/setup/cloudflared-setup";
import {
	deleteTunnel as cfDeleteTunnel,
	createTunnel,
	deleteDnsRecord,
	getTunnelToken,
	putTunnelConfig,
	upsertDnsCname,
} from "@/server/core/utils/cloudflare/client";
import {
	findZoneForHost,
	getCloudflareIntegration,
	requireCloudflareIntegration,
} from "./cloudflare";

const logger = createLogger("tunnel");

type Domain = typeof domains.$inferSelect;
export type Tunnel = typeof tunnels.$inferSelect;

// Traefik on the internal overlay network; the tunnel forwards everything here
// and Traefik routes by Host exactly as it does for the public path.
const TRAEFIK_INTERNAL_URL = "http://docklands-traefik:80";

/** The instance's tunnel (single per server by default), or null. */
export const getTunnel = async (): Promise<Tunnel | null> => {
	const tunnel = await db.query.tunnels.findFirst();
	return tunnel ?? null;
};

/**
 * Create a Cloudflare Tunnel (idempotent: returns the existing one if present),
 * point its single catch-all ingress rule at Traefik, and start the managed
 * cloudflared container. Requires a connected Cloudflare integration.
 */
export const provisionTunnel = async ({
	name = "docklands",
	runtimeWorkerId,
}: {
	name?: string;
	runtimeWorkerId?: string;
} = {}): Promise<Tunnel> => {
	const existing = await getTunnel();
	if (existing) {
		await startCloudflared(
			existing.token,
			existing.runtimeWorkerId ?? undefined,
		);
		return existing;
	}

	const integration = await requireCloudflareIntegration();
	const cf = await createTunnel(
		integration.apiToken,
		integration.accountId,
		name,
	);
	const runToken = await getTunnelToken(
		integration.apiToken,
		integration.accountId,
		cf.id,
	);
	await putTunnelConfig(integration.apiToken, integration.accountId, cf.id, [
		{ service: TRAEFIK_INTERNAL_URL },
	]);

	const [tunnel] = await db
		.insert(tunnels)
		.values({
			name,
			cfTunnelId: cf.id,
			token: runToken,
			runtimeWorkerId,
			status: "unknown",
		})
		.returning();
	if (!tunnel) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to store the tunnel",
		});
	}

	await startCloudflared(runToken, runtimeWorkerId);
	return tunnel;
};

/**
 * Restart the managed cloudflared for every stored tunnel. Called at startup so
 * tunnels survive a control-plane restart. Best-effort per tunnel.
 */
export const ensureTunnelRunning = async (): Promise<void> => {
	const allTunnels = await db.query.tunnels.findMany();
	for (const tunnel of allTunnels) {
		try {
			await startCloudflared(tunnel.token, tunnel.runtimeWorkerId ?? undefined);
		} catch (err) {
			logger.error(
				{ err, tunnelId: tunnel.tunnelId },
				"Failed to start cloudflared for tunnel",
			);
		}
	}
};

/** Remove a tunnel: stop cloudflared, delete it at Cloudflare, detach domains. */
export const teardownTunnel = async (tunnelId?: string): Promise<void> => {
	const tunnel = tunnelId
		? ((await db.query.tunnels.findFirst({
				where: eq(tunnels.tunnelId, tunnelId),
			})) ?? null)
		: await getTunnel();
	if (!tunnel) return;

	await stopCloudflared(tunnel.runtimeWorkerId ?? undefined);

	const integration = await getCloudflareIntegration();
	if (integration) {
		try {
			await cfDeleteTunnel(
				integration.apiToken,
				integration.accountId,
				tunnel.cfTunnelId,
			);
		} catch (err) {
			logger.warn(
				{ err, tunnelId: tunnel.tunnelId },
				"Failed to delete tunnel at Cloudflare (continuing)",
			);
		}
	}

	// Revert any domains served by this tunnel back to the public path.
	const attached = await db.query.domains.findMany({
		where: eq(domains.tunnelId, tunnel.tunnelId),
	});
	for (const domain of attached) {
		await detachDomainFromTunnel(domain);
		await db
			.update(domains)
			.set({ ingressMode: "public", tunnelId: null, cfDnsRecordId: null })
			.where(eq(domains.domainId, domain.domainId));
	}

	await db.delete(tunnels).where(eq(tunnels.tunnelId, tunnel.tunnelId));
};

/**
 * Expose a domain through the tunnel: create the proxied CNAME pointing the host
 * at the tunnel and flip the domain to tunnel mode (TLS terminates at the edge,
 * so the local certificate type becomes `none`). Traefik already routes the host
 * to the right container, so no Traefik change is needed here.
 */
export const attachDomainToTunnel = async (domain: Domain): Promise<void> => {
	const integration = await requireCloudflareIntegration();

	const tunnel = domain.tunnelId
		? await db.query.tunnels.findFirst({
				where: eq(tunnels.tunnelId, domain.tunnelId),
			})
		: await getTunnel();
	if (!tunnel) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "No Cloudflare Tunnel is provisioned. Provision one first.",
		});
	}

	const zone = findZoneForHost(integration.zones, domain.host);
	if (!zone) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `${domain.host} is not within a domain connected to Cloudflare.`,
		});
	}

	const recordId = await upsertDnsCname(
		integration.apiToken,
		zone.id,
		domain.host,
		`${tunnel.cfTunnelId}.cfargotunnel.com`,
	);

	await db
		.update(domains)
		.set({
			ingressMode: "tunnel",
			tunnelId: tunnel.tunnelId,
			cfDnsRecordId: recordId,
			certificateType: "none",
		})
		.where(eq(domains.domainId, domain.domainId));
};

/** Remove a domain's tunnel CNAME at Cloudflare (best-effort). */
export const detachDomainFromTunnel = async (domain: Domain): Promise<void> => {
	if (!domain.cfDnsRecordId) return;
	const integration = await getCloudflareIntegration();
	if (!integration) return;
	const zone = findZoneForHost(integration.zones, domain.host);
	if (!zone) return;
	try {
		await deleteDnsRecord(integration.apiToken, zone.id, domain.cfDnsRecordId);
	} catch (err) {
		logger.warn(
			{ err, domainId: domain.domainId },
			"Failed to delete tunnel DNS record (continuing)",
		);
	}
};
