import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import {
	type apiCreatePreviewDeployment,
	deployments,
	organization,
	previewDeployments,
} from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { generatePassword } from "../templates";
import { removeService } from "../utils/docker/utils";
import { removeDirectoryCode } from "../utils/filesystem/directory";
import { authGithub } from "../utils/providers/github";
import { removeTraefikConfig } from "../utils/traefik/application";
import { manageDomain } from "../utils/traefik/domain";
import { findApplicationById } from "./application";
import { removeDeploymentsByPreviewDeploymentId } from "./deployment";
import { createDomain } from "./domain";
import { type Github, getIssueComment } from "./github";
import { getWebServerSettings } from "./web-server-settings";

export type PreviewDeployment = typeof previewDeployments.$inferSelect;

const logger = createLogger("preview");

export const findPreviewDeploymentById = async (
	previewDeploymentId: string,
) => {
	const application = await db.query.previewDeployments.findFirst({
		where: eq(previewDeployments.previewDeploymentId, previewDeploymentId),
		with: {
			domain: true,
			application: {
				columns: {
					applicationId: true,
					runtimeWorkerId: true,
				},
			},
		},
	});
	if (!application) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Preview Deployment not found",
		});
	}
	return application;
};

export const removePreviewDeployment = async (previewDeploymentId: string) => {
	try {
		const previewDeployment =
			await findPreviewDeploymentById(previewDeploymentId);
		const application = await findApplicationById(
			previewDeployment.applicationId,
		);

		application.appName = previewDeployment.appName;

		logger.info(
			{ previewDeploymentId, appName: previewDeployment.appName },
			"Removing preview deployment",
		);

		const cleanupOperations = [
			async () =>
				await removeService(application?.appName, application?.runtimeWorkerId),
			async () =>
				await removeDeploymentsByPreviewDeploymentId(
					previewDeployment,
					application?.runtimeWorkerId,
				),
			async () =>
				await removeDirectoryCode(
					application?.appName,
					application?.runtimeWorkerId,
				),
			async () =>
				await removeTraefikConfig(
					application?.appName,
					application?.runtimeWorkerId,
				),
			async () =>
				await db
					.delete(previewDeployments)
					.where(
						eq(previewDeployments.previewDeploymentId, previewDeploymentId),
					)
					.returning(),
		];
		for (let i = 0; i < cleanupOperations.length; i++) {
			try {
				await cleanupOperations[i]?.();
			} catch (error) {
				logger.warn(
					{ err: error, previewDeploymentId, step: i },
					"Preview deployment cleanup step failed",
				);
			}
		}
		return previewDeployment;
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Error deleting this preview deployment";
		throw new TRPCError({
			code: "BAD_REQUEST",
			message,
		});
	}
};
// testing-tesoitnmg-ddq0ul-preview-ihl44o
export const updatePreviewDeployment = async (
	previewDeploymentId: string,
	previewDeploymentData: Partial<PreviewDeployment>,
) => {
	const application = await db
		.update(previewDeployments)
		.set({
			...previewDeploymentData,
		})
		.where(eq(previewDeployments.previewDeploymentId, previewDeploymentId))
		.returning();

	return application;
};

export const findPreviewDeploymentsByApplicationId = async (
	applicationId: string,
) => {
	const deploymentsList = await db.query.previewDeployments.findMany({
		where: eq(previewDeployments.applicationId, applicationId),
		orderBy: desc(previewDeployments.createdAt),
		with: {
			deployments: {
				orderBy: desc(deployments.createdAt),
			},
			domain: true,
		},
	});
	return deploymentsList;
};

/**
 * Compute an ISO `expiresAt` timestamp from a per-app expiration window, or
 * `null` when expiry is disabled (a non-positive number of days).
 */
export const computePreviewExpiresAt = (
	expirationDays: number | null | undefined,
): string | null => {
	const days = expirationDays ?? 0;
	if (days <= 0) {
		return null;
	}
	return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
};

/**
 * Refresh a preview's `expiresAt` window after a (re)deploy so actively updated
 * PRs are never reaped while abandoned ones eventually expire.
 */
export const refreshPreviewDeploymentExpiration = async (
	previewDeploymentId: string,
	expirationDays: number | null | undefined,
) => {
	await db
		.update(previewDeployments)
		.set({ expiresAt: computePreviewExpiresAt(expirationDays) })
		.where(eq(previewDeployments.previewDeploymentId, previewDeploymentId));
};

export const createPreviewDeployment = async (
	schema: z.infer<typeof apiCreatePreviewDeployment>,
) => {
	const application = await findApplicationById(schema.applicationId);
	const appName = `preview-${application.appName}-${generatePassword(6)}`;

	const org = await db.query.organization.findFirst({
		where: eq(
			organization.id,
			application.environment.workspace.organizationId,
		),
	});
	const generateDomain = await generateWildcardDomain(
		application.previewWildcard || "*.sslip.io",
		appName,
		application.runtimeWorker?.ipAddress || "",
		org?.ownerId || "",
	);

	const octokit = authGithub(application?.github as Github);

	const runningComment = getIssueComment(
		application.name,
		"initializing",
		`${application.previewHttps ? "https" : "http"}://${generateDomain}`,
	);

	const issue = await octokit.rest.issues.createComment({
		owner: application?.owner || "",
		repo: application?.repository || "",
		issue_number: Number.parseInt(schema.pullRequestNumber, 10),
		body: `### Docklands Preview Deployment\n\n${runningComment}`,
	});

	const previewDeployment = await db
		.insert(previewDeployments)
		.values({
			...schema,
			appName: appName,
			pullRequestCommentId: `${issue.data.id}`,
			expiresAt: computePreviewExpiresAt(application.previewExpirationDays),
		})
		.returning()
		.then((value) => value[0]);

	if (!previewDeployment) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the preview deployment",
		});
	}

	const newDomain = await createDomain({
		host: generateDomain,
		path: application.previewPath,
		port: application.previewPort,
		https: application.previewHttps,
		certificateType: application.previewCertificateType,
		customCertResolver: application.previewCustomCertResolver,
		domainType: "preview",
		previewDeploymentId: previewDeployment.previewDeploymentId,
	});

	application.appName = appName;

	await manageDomain(application, newDomain);

	await db
		.update(previewDeployments)
		.set({
			domainId: newDomain.domainId,
		})
		.where(
			eq(
				previewDeployments.previewDeploymentId,
				previewDeployment.previewDeploymentId,
			),
		);

	return previewDeployment;
};

export const findPreviewDeploymentsByPullRequestId = async (
	pullRequestId: string,
) => {
	const previewDeploymentResult = await db.query.previewDeployments.findMany({
		where: eq(previewDeployments.pullRequestId, pullRequestId),
	});

	return previewDeploymentResult;
};

export const findPreviewDeploymentByApplicationId = async (
	applicationId: string,
	pullRequestId: string,
) => {
	const previewDeploymentResult = await db.query.previewDeployments.findFirst({
		where: and(
			eq(previewDeployments.applicationId, applicationId),
			eq(previewDeployments.pullRequestId, pullRequestId),
		),
	});

	return previewDeploymentResult;
};

const generateWildcardDomain = async (
	baseDomain: string,
	appName: string,
	serverIp: string,
	_userId: string,
): Promise<string> => {
	if (!baseDomain.startsWith("*.")) {
		throw new Error('The base domain must start with "*."');
	}
	const hash = `${appName}`;
	if (baseDomain.includes("sslip.io")) {
		let ip = "";

		if (process.env.NODE_ENV === "development") {
			ip = "127.0.0.1";
		}

		if (serverIp) {
			ip = serverIp;
		}

		if (!ip) {
			const settings = await getWebServerSettings();
			ip = settings?.serverIp || "";
		}

		const slugIp = ip.replaceAll(".", "-");
		return baseDomain.replace(
			"*",
			`${hash}${slugIp === "" ? "" : `-${slugIp}`}`,
		);
	}

	return baseDomain.replace("*", hash);
};
