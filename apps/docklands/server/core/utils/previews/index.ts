import { and, isNotNull, lt } from "drizzle-orm";
import { scheduleJob } from "node-schedule";
import { previewDeployments } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { removePreviewDeployment } from "@/server/core/services/preview-deployment";
import { db } from "../../db/index";

const logger = createLogger("preview-cleanup");

// Hourly. Preview `expiresAt` is an ISO-8601 string, which sorts
// lexicographically the same as chronologically, so a string `lt` comparison
// against the current time is a correct "is expired" check.
const PREVIEW_CLEANUP_CRON = "0 * * * *";

/**
 * Tear down every preview deployment whose `expiresAt` window has passed.
 * Previews with a null `expiresAt` (expiry disabled) are never reaped here;
 * they are still cleaned up when their pull request closes.
 */
export const reapExpiredPreviewDeployments = async () => {
	const nowIso = new Date().toISOString();
	const expired = await db.query.previewDeployments.findMany({
		where: and(
			isNotNull(previewDeployments.expiresAt),
			lt(previewDeployments.expiresAt, nowIso),
		),
	});

	for (const preview of expired) {
		try {
			await removePreviewDeployment(preview.previewDeploymentId);
		} catch (error) {
			logger.warn(
				{ err: error, previewDeploymentId: preview.previewDeploymentId },
				"Failed to reap expired preview deployment",
			);
		}
	}

	return expired.length;
};

export const initPreviewCleanupCron = () => {
	logger.info("Setting up preview deployment cleanup cron job");
	scheduleJob("preview-cleanup", PREVIEW_CLEANUP_CRON, async () => {
		try {
			const reaped = await reapExpiredPreviewDeployments();
			if (reaped > 0) {
				logger.info({ reaped }, "Reaped expired preview deployments");
			}
		} catch (error) {
			logger.error({ err: error }, "Error in preview cleanup cron");
		}
	});
};
