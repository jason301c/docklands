import { eq } from "drizzle-orm";
import { schedules } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { db } from "../../db/index";
import { scheduleJob } from "./utils";

const logger = createLogger("schedule");

export const initSchedules = async () => {
	try {
		const schedulesResult = await db.query.schedules.findMany({
			where: eq(schedules.enabled, true),
			with: {
				runtimeWorker: true,
				application: true,
				compose: true,
				organization: true,
			},
		});

		logger.info(
			{ count: schedulesResult.length },
			"Initializing schedule jobs",
		);
		for (const schedule of schedulesResult) {
			scheduleJob(schedule);
			logger.info(
				{
					scheduleId: schedule.scheduleId,
					name: schedule.name,
					type: schedule.scheduleType,
				},
				"Schedule job registered",
			);
		}
	} catch (error) {
		logger.error({ err: error }, "Failed to initialize schedule jobs");
		throw error;
	}
};
