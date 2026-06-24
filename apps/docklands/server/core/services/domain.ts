import dns from "node:dns";
import { promisify } from "node:util";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { detectCDNProvider } from "@/server/core/constants/cdn";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import { createLogger } from "@/server/core/lib/logger";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { generateRandomDomain } from "@/server/core/templates";
import { manageDomain } from "@/server/core/utils/traefik/domain";
import { type apiCreateDomain, domains } from "../db/schema";
import { findApplicationById } from "./application";
import { findZoneForHost, requireCloudflareIntegration } from "./cloudflare";
import { findRuntimeWorkerById } from "./runtime-worker";
import { attachDomainToTunnel, detachDomainFromTunnel } from "./tunnel";

const logger = createLogger("domain");

export type Domain = typeof domains.$inferSelect;

export const createDomain = async (input: z.infer<typeof apiCreateDomain>) => {
	const host = input.host?.trim();
	const settings = await getWebServerSettings();
	// Explicit choice wins; otherwise the instance default (set at onboarding).
	const ingressMode =
		input.ingressMode ?? settings?.defaultIngressMode ?? "public";

	// Fail fast before mutating: tunnel mode needs a connected Cloudflare zone
	// that owns this host.
	if (ingressMode === "tunnel") {
		const integration = await requireCloudflareIntegration();
		if (!findZoneForHost(integration.zones, host ?? "")) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `${host} is not within a domain connected to Cloudflare.`,
			});
		}
	}

	const result = await db.transaction(async (tx) => {
		const domain = await tx
			.insert(domains)
			.values({
				...input,
				host,
				ingressMode,
				// In tunnel mode TLS terminates at the Cloudflare edge, so Traefik
				// serves plain HTTP internally — no local certificate.
				...(ingressMode === "tunnel" ? { certificateType: "none" } : {}),
			} as typeof domains.$inferInsert)
			.returning()
			.then((response) => response[0]);

		if (!domain) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error creating domain",
			});
		}

		if (domain.applicationId) {
			const application = await findApplicationById(domain.applicationId);
			await manageDomain(application, domain);
		}

		return domain;
	});

	// DNS/CNAME creation is a network call, so it runs outside the transaction.
	if (result.ingressMode === "tunnel") {
		await attachDomainToTunnel(result);
	}

	return result;
};

export const generateTraefikMeDomain = async (
	appName: string,
	_userId: string,
	runtimeWorkerId?: string,
) => {
	if (runtimeWorkerId) {
		const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);
		return generateRandomDomain({
			serverIp: runtimeWorker.ipAddress,
			projectName: appName,
		});
	}

	if (process.env.NODE_ENV === "development") {
		return generateRandomDomain({
			serverIp: "",
			projectName: appName,
		});
	}
	const settings = await getWebServerSettings();
	return generateRandomDomain({
		serverIp: settings?.serverIp || "",
		projectName: appName,
	});
};

export const generateWildcardDomain = (
	appName: string,
	serverDomain: string,
) => {
	return `${appName}-${serverDomain}`;
};

export const findDomainById = async (domainId: string) => {
	return orThrowNotFound(
		db.query.domains.findFirst({
			where: eq(domains.domainId, domainId),
			with: {
				application: true,
			},
		}),
		"Domain",
	);
};

export const findDomainsByApplicationId = async (applicationId: string) => {
	const domainsArray = await db.query.domains.findMany({
		where: eq(domains.applicationId, applicationId),
		with: {
			application: true,
		},
	});

	return domainsArray;
};

export const findDomainsByComposeId = async (composeId: string) => {
	const domainsArray = await db.query.domains.findMany({
		where: eq(domains.composeId, composeId),
		with: {
			compose: true,
		},
	});

	return domainsArray;
};

export const updateDomainById = async (
	domainId: string,
	domainData: Partial<Domain>,
) => {
	const existing = await findDomainById(domainId);
	const newHost = (domainData.host ?? existing.host)?.trim();
	const newMode = domainData.ingressMode ?? existing.ingressMode;

	// Tunnel mode (whether switching to it or changing host while in it) requires
	// a connected Cloudflare zone that owns the host — fail fast before mutating.
	if (newMode === "tunnel") {
		const integration = await requireCloudflareIntegration();
		if (!findZoneForHost(integration.zones, newHost ?? "")) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `${newHost} is not within a domain connected to Cloudflare.`,
			});
		}
	}

	const switchingToPublic =
		existing.ingressMode === "tunnel" && newMode === "public";

	const domain = await db
		.update(domains)
		.set({
			...domainData,
			...(domainData.host && { host: newHost }),
			// Tunnel terminates TLS at the edge → no local certificate.
			...(newMode === "tunnel" ? { certificateType: "none" } : {}),
			// Leaving tunnel mode: drop the now-stale tunnel linkage.
			...(switchingToPublic ? { tunnelId: null, cfDnsRecordId: null } : {}),
		})
		.where(eq(domains.domainId, domainId))
		.returning()
		.then((rows) => rows[0]);

	if (!domain) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error updating domain",
		});
	}

	// Reconcile the tunnel DNS record for host/mode changes. Without this, editing
	// a tunnel domain's host left the old CNAME in place and traffic silently
	// stopped. Network calls, so outside any transaction and best-effort.
	const wasTunnel = existing.ingressMode === "tunnel";
	const isTunnel = domain.ingressMode === "tunnel";
	const hostChanged = existing.host !== domain.host;
	try {
		if (wasTunnel && (!isTunnel || hostChanged)) {
			// detach uses existing.cfDnsRecordId (the record for the OLD host).
			await detachDomainFromTunnel(existing);
		}
		if (isTunnel && (!wasTunnel || hostChanged)) {
			await attachDomainToTunnel(domain);
		}
	} catch (err) {
		logger.warn(
			{ err, domainId },
			"Failed to reconcile tunnel DNS on domain update",
		);
	}

	return domain;
};

export const removeDomainById = async (domainId: string) => {
	const domain = await findDomainById(domainId);

	// Remove the tunnel's DNS record before dropping the row (best-effort).
	if (domain.ingressMode === "tunnel") {
		await detachDomainFromTunnel(domain);
	}

	const result = await db
		.delete(domains)
		.where(eq(domains.domainId, domainId))
		.returning();

	return result[0];
};

export const getDomainHost = (domain: Domain) => {
	return `${domain.https ? "https" : "http"}://${domain.host}`;
};

const resolveDns = promisify(dns.resolve4);

export const validateDomain = async (
	domain: string,
	expectedIp?: string,
): Promise<{
	isValid: boolean;
	resolvedIp?: string;
	error?: string;
	isCloudflare?: boolean;
	cdnProvider?: string;
}> => {
	try {
		// Remove protocol and path if present
		const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0];

		// Resolve the domain to get its IP
		const ips = await resolveDns(cleanDomain || "");

		const resolvedIps = ips.map((ip) => ip.toString());

		// Check if any IP belongs to a CDN provider
		const cdnProvider = ips
			.map((ip) => detectCDNProvider(ip))
			.find((provider) => provider !== null);

		// If behind a CDN, we consider it valid but inform the user
		if (cdnProvider) {
			return {
				isValid: true,
				resolvedIp: resolvedIps.join(", "),
				cdnProvider: cdnProvider.displayName,
				error: cdnProvider.warningMessage,
			};
		}

		// If we have an expected IP, validate against it
		if (expectedIp) {
			return {
				isValid: resolvedIps.includes(expectedIp),
				resolvedIp: resolvedIps.join(", "),
				error: !resolvedIps.includes(expectedIp)
					? `Domain resolves to ${resolvedIps.join(", ")} but should point to ${expectedIp}`
					: undefined,
			};
		}

		// If no expected IP, just return the resolved IP
		return {
			isValid: true,
			resolvedIp: resolvedIps.join(", "),
		};
	} catch (error) {
		return {
			isValid: false,
			error:
				error instanceof Error ? error.message : "Failed to resolve domain",
		};
	}
};
