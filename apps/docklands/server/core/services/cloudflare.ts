import { TRPCError } from "@trpc/server";
import { db } from "@/server/core/db";
import { cloudflareIntegration } from "@/server/core/db/schema";
import {
	type CloudflareZone,
	listAccounts,
	listZones,
	verifyToken,
} from "@/server/core/utils/cloudflare/client";

export type CloudflareIntegration = typeof cloudflareIntegration.$inferSelect;

/**
 * The single Cloudflare integration row, or null if not connected. The
 * `apiToken` column is transparently decrypted on read.
 */
export const getCloudflareIntegration =
	async (): Promise<CloudflareIntegration | null> => {
		const integration = await db.query.cloudflareIntegration.findFirst();
		return integration ?? null;
	};

/** Like {@link getCloudflareIntegration} but throws when not connected. */
export const requireCloudflareIntegration =
	async (): Promise<CloudflareIntegration> => {
		const integration = await getCloudflareIntegration();
		if (!integration) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Cloudflare is not connected. Add an API token first.",
			});
		}
		return integration;
	};

/**
 * Validate a Cloudflare API token, resolve the account + zones it can manage,
 * and store it (encrypted) as the instance's single integration. Replaces any
 * existing integration.
 */
export const connectCloudflare = async (
	apiToken: string,
): Promise<CloudflareIntegration> => {
	await verifyToken(apiToken);

	const accounts = await listAccounts(apiToken);
	const account = accounts[0];
	if (!account) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"The token has no accessible Cloudflare account. Check its scope.",
		});
	}

	const zones = await listZones(apiToken);

	return db.transaction(async (tx) => {
		await tx.delete(cloudflareIntegration);
		const [created] = await tx
			.insert(cloudflareIntegration)
			.values({
				apiToken,
				accountId: account.id,
				accountName: account.name,
				zones,
			})
			.returning();
		if (!created) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to store the Cloudflare integration",
			});
		}
		return created;
	});
};

/** Re-fetch the zone list for the connected token and persist it. */
export const refreshCloudflareZones = async (): Promise<CloudflareZone[]> => {
	const integration = await requireCloudflareIntegration();
	const zones = await listZones(integration.apiToken);
	await db.update(cloudflareIntegration).set({ zones });
	return zones;
};

export const disconnectCloudflare = async (): Promise<void> => {
	const tunnel = await db.query.tunnels.findFirst();
	if (tunnel) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"Remove the managed Cloudflare Tunnel before disconnecting Cloudflare.",
		});
	}

	await db.delete(cloudflareIntegration);
};

/**
 * Find the zone that owns a hostname (the longest zone name that is a suffix of
 * the host), e.g. host `docs.example.com` → zone `example.com`.
 */
export const findZoneForHost = (
	zones: CloudflareZone[],
	host: string,
): CloudflareZone | null => {
	const matches = zones.filter(
		(z) => host === z.name || host.endsWith(`.${z.name}`),
	);
	matches.sort((a, b) => b.name.length - a.name.length);
	return matches[0] ?? null;
};
