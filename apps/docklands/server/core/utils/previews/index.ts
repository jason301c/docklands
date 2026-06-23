import { and, isNotNull, lt } from "drizzle-orm";
import { scheduleJob } from "node-schedule";
import { previewDeployments } from "@/server/core/db/schema";
import { removePreviewDeployment } from "@/server/core/services/preview-deployment";
import { db } from "../../db/index";

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
			console.log(
				`Error reaping expired preview ${preview.previewDeploymentId}: ${error}`,
			);
		}
	}

	return expired.length;
};

export const initPreviewCleanupCron = () => {
	console.log("Setting up preview deployment cleanup cron job....");
	scheduleJob("preview-cleanup", PREVIEW_CLEANUP_CRON, async () => {
		try {
			const reaped = await reapExpiredPreviewDeployments();
			if (reaped > 0) {
				console.log(`Reaped ${reaped} expired preview deployment(s)`);
			}
		} catch (error) {
			console.log(`Error in preview cleanup cron: ${error}`);
		}
	});
};
