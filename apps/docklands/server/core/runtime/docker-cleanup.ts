import { scheduledJobs, scheduleJob } from "node-schedule";
import { CLEANUP_CRON_JOB } from "@/server/core/constants/cleanup";
import { IS_CLOUD } from "@/server/core/constants/env";
import { cleanupAll } from "@/server/core/utils/docker/utils";
import { sendDockerCleanupNotifications } from "@/server/core/utils/notifications/docker-cleanup";
import { removeJob, schedule } from "./backup";

export const applyDockerCleanupSchedule = async (
	runtimeWorkerId: string,
	organizationId: string,
	enable: boolean,
) => {
	if (enable) {
		if (IS_CLOUD) {
			await schedule({
				cronSchedule: CLEANUP_CRON_JOB,
				runtimeWorkerId,
				type: "runtimeWorker",
			});
		} else {
			scheduleJob(runtimeWorkerId, CLEANUP_CRON_JOB, async () => {
				await cleanupAll(runtimeWorkerId);
				await sendDockerCleanupNotifications(organizationId);
			});
		}
	} else {
		if (IS_CLOUD) {
			await removeJob({
				cronSchedule: CLEANUP_CRON_JOB,
				runtimeWorkerId,
				type: "runtimeWorker",
			});
		} else {
			scheduledJobs[runtimeWorkerId]?.cancel();
		}
	}
};
