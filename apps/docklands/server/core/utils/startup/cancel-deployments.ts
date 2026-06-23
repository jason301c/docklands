import { eq, inArray } from "drizzle-orm";
import { applications, compose, deployments } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { db } from "../../db/index";

const logger = createLogger("startup");

export const initCancelDeployments = async () => {
	try {
		logger.info("Cancelling in-progress deployments from previous run");

		const result = await db
			.update(deployments)
			.set({
				status: "cancelled",
			})
			.where(eq(deployments.status, "running"))
			.returning();

		// Reset the related services so they don't stay stuck in "running".
		const applicationIds = [
			...new Set(
				result
					.map((deployment) => deployment.applicationId)
					.filter((id): id is string => !!id),
			),
		];
		const composeIds = [
			...new Set(
				result
					.map((deployment) => deployment.composeId)
					.filter((id): id is string => !!id),
			),
		];

		if (applicationIds.length > 0) {
			await db
				.update(applications)
				.set({ applicationStatus: "idle" })
				.where(inArray(applications.applicationId, applicationIds));
		}

		if (composeIds.length > 0) {
			await db
				.update(compose)
				.set({ composeStatus: "idle" })
				.where(inArray(compose.composeId, composeIds));
		}

		logger.info(
			{ cancelled: result.length },
			"In-progress deployments cancelled",
		);
	} catch (error) {
		logger.error({ err: error }, "Failed to cancel in-progress deployments");
		throw error;
	}
};
