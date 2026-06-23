import { scheduledJobs, scheduleJob } from "node-schedule";
import { CLEANUP_CRON_JOB } from "@/server/core/constants/cleanup";
import { cleanupAll } from "@/server/core/utils/docker/utils";
import { sendDockerCleanupNotifications } from "@/server/core/utils/notifications/docker-cleanup";

export const applyDockerCleanupSchedule = async (
	runtimeWorkerId: string,
	organizationId: string,
	enable: boolean,
) => {
	if (enable) {
		scheduleJob(runtimeWorkerId, CLEANUP_CRON_JOB, async () => {
			await cleanupAll(runtimeWorkerId);
			await sendDockerCleanupNotifications(organizationId);
		});
	} else {
		scheduledJobs[runtimeWorkerId]?.cancel();
	}
};
