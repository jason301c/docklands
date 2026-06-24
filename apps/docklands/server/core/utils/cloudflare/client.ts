import { createLogger } from "@/server/core/lib/logger";

/**
 * Minimal Cloudflare API client. Every call takes the user's API token as an
 * argument (decrypted by the caller) and this module NEVER logs it. Failures
 * surface Cloudflare's own error messages, which are safe to show, but never
 * the token or request headers.
 *
 * @see https://developers.cloudflare.com/api/
 */

const logger = createLogger("cloudflare");

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export interface CloudflareZone {
	id: string;
	name: string;
}

export interface CloudflareAccount {
	id: string;
	name: string;
}

interface CloudflareEnvelope<T> {
	success: boolean;
	errors: { code: number; message: string }[];
	messages: { code: number; message: string }[];
	result: T;
}

export class CloudflareApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "CloudflareApiError";
	}
}

const cfFetch = async <T>(
	token: string,
	path: string,
	init?: RequestInit,
): Promise<T> => {
	let response: Response;
	try {
		response = await fetch(`${CF_API_BASE}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				...init?.headers,
			},
		});
	} catch (err) {
		// Network-level failure — log without the token (err carries no secret).
		logger.error({ err, path }, "Cloudflare request failed");
		throw new CloudflareApiError(
			"Could not reach the Cloudflare API. Check the server's network access.",
			0,
		);
	}

	const body = (await response
		.json()
		.catch(() => null)) as CloudflareEnvelope<T> | null;

	if (!response.ok || !body?.success) {
		const detail =
			body?.errors?.map((e) => e.message).join("; ") || response.statusText;
		// Path is safe to log; token never appears in path or detail.
		logger.warn({ path, status: response.status, detail }, "Cloudflare error");
		throw new CloudflareApiError(
			detail || "Cloudflare API request failed",
			response.status,
		);
	}

	return body.result;
};

/** Validate a token (`/user/tokens/verify`). Throws if invalid. */
export const verifyToken = async (token: string): Promise<void> => {
	await cfFetch<{ id: string; status: string }>(token, "/user/tokens/verify");
};

/** The accounts the token can act on. The first is used as the default. */
export const listAccounts = async (
	token: string,
): Promise<CloudflareAccount[]> => {
	const accounts = await cfFetch<CloudflareAccount[]>(token, "/accounts");
	return accounts.map((a) => ({ id: a.id, name: a.name }));
};

/** The zones (root domains) the token can manage DNS for. */
export const listZones = async (token: string): Promise<CloudflareZone[]> => {
	const zones = await cfFetch<CloudflareZone[]>(
		token,
		"/zones?per_page=50&status=active",
	);
	return zones.map((z) => ({ id: z.id, name: z.name }));
};

/**
 * Create a remotely-managed tunnel (`config_src: "cloudflare"`), so its ingress
 * config lives at Cloudflare and is driven via the API — nothing is written to
 * disk on the server.
 */
export const createTunnel = async (
	token: string,
	accountId: string,
	name: string,
): Promise<{ id: string; name: string }> => {
	return cfFetch<{ id: string; name: string }>(
		token,
		`/accounts/${accountId}/cfd_tunnel`,
		{
			method: "POST",
			body: JSON.stringify({ name, config_src: "cloudflare" }),
		},
	);
};

/** The `cloudflared` run token for a tunnel (used as `TUNNEL_TOKEN`). */
export const getTunnelToken = async (
	token: string,
	accountId: string,
	cfTunnelId: string,
): Promise<string> => {
	return cfFetch<string>(
		token,
		`/accounts/${accountId}/cfd_tunnel/${cfTunnelId}/token`,
	);
};

export interface TunnelIngressRule {
	hostname?: string;
	service: string;
}

/**
 * Set a tunnel's ingress rules. Docklands uses a single catch-all rule that
 * forwards everything to Traefik, which then routes by host. The final rule
 * must be a bare `service` with no hostname (Cloudflare requires a catch-all).
 */
export const putTunnelConfig = async (
	token: string,
	accountId: string,
	cfTunnelId: string,
	ingress: TunnelIngressRule[],
): Promise<void> => {
	await cfFetch(
		token,
		`/accounts/${accountId}/cfd_tunnel/${cfTunnelId}/configurations`,
		{
			method: "PUT",
			body: JSON.stringify({ config: { ingress } }),
		},
	);
};

export const deleteTunnel = async (
	token: string,
	accountId: string,
	cfTunnelId: string,
): Promise<void> => {
	await cfFetch(token, `/accounts/${accountId}/cfd_tunnel/${cfTunnelId}`, {
		method: "DELETE",
	});
};

interface DnsRecord {
	id: string;
	name: string;
	type: string;
	content: string;
}

/**
 * Create or update a proxied CNAME pointing a host at the tunnel
 * (`<cfTunnelId>.cfargotunnel.com`). Returns the DNS record id so it can be
 * deleted when the domain is removed.
 */
export const upsertDnsCname = async (
	token: string,
	zoneId: string,
	name: string,
	target: string,
): Promise<string> => {
	const existing = await cfFetch<DnsRecord[]>(
		token,
		`/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
	);

	const payload = JSON.stringify({
		type: "CNAME",
		name,
		content: target,
		proxied: true,
		ttl: 1,
	});

	const current = existing[0];
	if (current) {
		const updated = await cfFetch<DnsRecord>(
			token,
			`/zones/${zoneId}/dns_records/${current.id}`,
			{ method: "PUT", body: payload },
		);
		return updated.id;
	}

	const created = await cfFetch<DnsRecord>(
		token,
		`/zones/${zoneId}/dns_records`,
		{ method: "POST", body: payload },
	);
	return created.id;
};

export const deleteDnsRecord = async (
	token: string,
	zoneId: string,
	recordId: string,
): Promise<void> => {
	await cfFetch(token, `/zones/${zoneId}/dns_records/${recordId}`, {
		method: "DELETE",
	});
};
