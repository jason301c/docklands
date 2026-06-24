import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { z } from "zod";
import { encryptedText } from "@/server/core/db/encrypted";

/**
 * The instance's connection to Cloudflare. Single-tenant, so there is at most
 * one row. The API token is stored encrypted at rest (see `encryptedText`) and
 * is used to provision tunnels and manage DNS records on the user's zones.
 */
export const cloudflareIntegration = pgTable("cloudflare_integration", {
	id: text("id")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	apiToken: encryptedText("apiToken").notNull(),
	accountId: text("accountId").notNull(),
	accountName: text("accountName"),
	// Cached list of the zones (root domains) the token can manage DNS for.
	zones: jsonb("zones")
		.$type<{ id: string; name: string }[]>()
		.notNull()
		.default([]),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export type TunnelStatus = "healthy" | "degraded" | "down" | "unknown";

/**
 * A Cloudflare Tunnel managed by Docklands. Docklands runs one `cloudflared`
 * container per server (per runtime worker) with a single catch-all ingress
 * rule that forwards everything to Traefik, which then routes by host exactly
 * as it does for the public path.
 */
export const tunnels = pgTable("tunnel", {
	tunnelId: text("tunnelId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	// Cloudflare's own tunnel UUID (DNS targets are `<cfTunnelId>.cfargotunnel.com`).
	cfTunnelId: text("cfTunnelId").notNull(),
	// The `cloudflared` run token, encrypted at rest.
	token: encryptedText("token").notNull(),
	// Which server runs the cloudflared container; null = the local server.
	runtimeWorkerId: text("runtimeWorkerId"),
	status: text("status").$type<TunnelStatus>().notNull().default("unknown"),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const apiConnectCloudflare = z.object({
	apiToken: z.string().min(1, { message: "Add a Cloudflare API token" }),
});

export const apiProvisionTunnel = z.object({
	name: z.string().min(1).optional(),
	runtimeWorkerId: z.string().optional(),
});
