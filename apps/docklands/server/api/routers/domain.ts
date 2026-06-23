import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateDomain,
	apiFindCompose,
	apiFindDomain,
	apiFindOneApplication,
	apiUpdateDomain,
} from "@/server/core/db/schema";
import { findApplicationById } from "@/server/core/services/application";
import {
	createDomain,
	findDomainById,
	findDomainsByApplicationId,
	findDomainsByComposeId,
	generateTraefikMeDomain,
	removeDomainById,
	updateDomainById,
	validateDomain,
} from "@/server/core/services/domain";
import { checkServicePermissionAndAccess } from "@/server/core/services/permission";
import { findPreviewDeploymentById } from "@/server/core/services/preview-deployment";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { manageDomain, removeDomain } from "@/server/core/utils/traefik/domain";

/**
 * The ACME placeholder shipped in the default Traefik config. Until an admin sets
 * a real Let's Encrypt email in ingress settings, the resolver still carries this
 * bogus address — Let's Encrypt would reject (or send nothing to) it. Treat it as
 * "unset" so we never enable LE on a domain with a placeholder contact email.
 */
const LETSENCRYPT_PLACEHOLDER_EMAIL = "test@localhost.com";

/**
 * Guard against enabling Let's Encrypt on a domain while the ingress LE contact
 * email is still empty/unset/the placeholder. Only the `letsencrypt` cert
 * resolver uses this email — uploaded certs (`none`) and custom resolvers
 * (`custom`), and HTTP-only domains, are intentionally left alone.
 */
const assertLetsEncryptEmailConfigured = async (
	https: boolean | null | undefined,
	certificateType: string | null | undefined,
) => {
	if (!https || certificateType !== "letsencrypt") return;

	const settings = await getWebServerSettings();
	const email = settings?.letsEncryptEmail?.trim();
	if (!email || email === LETSENCRYPT_PLACEHOLDER_EMAIL) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Set a Let's Encrypt email in ingress settings before enabling " +
				"Let's Encrypt HTTPS on a domain. Certificate issuance will fail " +
				"without a valid contact email.",
		});
	}
};

export const domainRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateDomain)
		.mutation(async ({ input, ctx }) => {
			try {
				await assertLetsEncryptEmailConfigured(
					input.https,
					input.certificateType,
				);
				if (input.domainType === "compose" && input.composeId) {
					await checkServicePermissionAndAccess(ctx, input.composeId, {
						domain: ["create"],
					});
				} else if (input.domainType === "application" && input.applicationId) {
					await checkServicePermissionAndAccess(ctx, input.applicationId, {
						domain: ["create"],
					});
				}
				const domain = await createDomain(input);
				await audit(ctx, {
					action: "create",
					resourceType: "domain",
					resourceId: domain.domainId,
					resourceName: domain.host,
				});
				return domain;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error creating the domain",
					cause: error,
				});
			}
		}),
	byApplicationId: protectedProcedure
		.input(apiFindOneApplication)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				domain: ["read"],
			});
			return await findDomainsByApplicationId(input.applicationId);
		}),
	byComposeId: protectedProcedure
		.input(apiFindCompose)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				domain: ["read"],
			});
			return await findDomainsByComposeId(input.composeId);
		}),
	generateDomain: withPermission("domain", "create")
		.input(
			z.object({ appName: z.string(), runtimeWorkerId: z.string().optional() }),
		)
		.mutation(async ({ input, ctx }) => {
			return generateTraefikMeDomain(
				input.appName,
				ctx.user.ownerId,
				input.runtimeWorkerId,
			);
		}),
	canGenerateTraefikMeDomains: withPermission("domain", "read")
		.input(z.object({ runtimeWorkerId: z.string() }))
		.query(async ({ input }) => {
			if (input.runtimeWorkerId) {
				const runtimeWorker = await findRuntimeWorkerById(
					input.runtimeWorkerId,
				);
				return runtimeWorker.ipAddress;
			}
			const settings = await getWebServerSettings();
			return settings?.serverIp || "";
		}),

	update: protectedProcedure
		.input(apiUpdateDomain)
		.mutation(async ({ input, ctx }) => {
			const currentDomain = await findDomainById(input.domainId);

			// Evaluate the *effective* post-update state: a partial update may omit
			// `https`/`certificateType`, so fall back to the persisted values.
			await assertLetsEncryptEmailConfigured(
				input.https ?? currentDomain.https,
				input.certificateType ?? currentDomain.certificateType,
			);

			const serviceId = currentDomain.applicationId || currentDomain.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					domain: ["create"],
				});
			} else if (currentDomain.previewDeploymentId) {
				const preview = await findPreviewDeploymentById(
					currentDomain.previewDeploymentId,
				);
				await checkServicePermissionAndAccess(ctx, preview.applicationId, {
					domain: ["create"],
				});
			}

			const result = await updateDomainById(input.domainId, input);
			const domain = await findDomainById(input.domainId);
			await audit(ctx, {
				action: "update",
				resourceType: "domain",
				resourceId: domain.domainId,
				resourceName: domain.host,
			});
			if (domain.applicationId) {
				const application = await findApplicationById(domain.applicationId);
				await manageDomain(application, domain);
			} else if (domain.previewDeploymentId) {
				const previewDeployment = await findPreviewDeploymentById(
					domain.previewDeploymentId,
				);
				const application = await findApplicationById(
					previewDeployment.applicationId,
				);
				application.appName = previewDeployment.appName;
				await manageDomain(application, domain);
			}
			return result;
		}),
	one: protectedProcedure.input(apiFindDomain).query(async ({ input, ctx }) => {
		const domain = await findDomainById(input.domainId);
		const serviceId = domain.applicationId || domain.composeId;
		if (serviceId) {
			await checkServicePermissionAndAccess(ctx, serviceId, {
				domain: ["read"],
			});
		} else if (domain.previewDeploymentId) {
			const preview = await findPreviewDeploymentById(
				domain.previewDeploymentId,
			);
			await checkServicePermissionAndAccess(ctx, preview.applicationId, {
				domain: ["read"],
			});
		}
		return domain;
	}),
	delete: protectedProcedure
		.input(apiFindDomain)
		.mutation(async ({ input, ctx }) => {
			const domain = await findDomainById(input.domainId);
			const serviceId = domain.applicationId || domain.composeId;
			if (serviceId) {
				await checkServicePermissionAndAccess(ctx, serviceId, {
					domain: ["delete"],
				});
			} else if (domain.previewDeploymentId) {
				const preview = await findPreviewDeploymentById(
					domain.previewDeploymentId,
				);
				await checkServicePermissionAndAccess(ctx, preview.applicationId, {
					domain: ["delete"],
				});
			}

			const result = await removeDomainById(input.domainId);
			await audit(ctx, {
				action: "delete",
				resourceType: "domain",
				resourceId: domain.domainId,
				resourceName: domain.host,
			});

			if (domain.applicationId) {
				const application = await findApplicationById(domain.applicationId);
				await removeDomain(application, domain.uniqueConfigKey);
			}

			return result;
		}),

	validateDomain: withPermission("domain", "read")
		.input(
			z.object({
				domain: z.string(),
				serverIp: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			return validateDomain(input.domain, input.serverIp);
		}),
});
