import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import type { DeploymentJob } from "@/server/queues/queue-types";
import {
	cleanQueuesByApplication,
	cleanQueuesByCompose,
	myQueue,
} from "@/server/queues/queueSetup";

export const deploy = async (jobData: DeploymentJob) => {
	if (jobData.runtimeWorkerId) {
		const runtimeWorker = await findRuntimeWorkerById(
			jobData.runtimeWorkerId as string,
		);
		if (runtimeWorker.runtimeWorkerStatus === "inactive") {
			throw new Error("Server is inactive");
		}
	}

	return myQueue.add(
		"deployments",
		{ ...jobData },
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
};

type CancelDeploymentData =
	| { applicationId: string; applicationType: "application" }
	| { composeId: string; applicationType: "compose" };

export const cancelDeployment = async (cancelData: CancelDeploymentData) => {
	if (cancelData.applicationType === "application") {
		await cleanQueuesByApplication(cancelData.applicationId);
	} else {
		await cleanQueuesByCompose(cancelData.composeId);
	}

	return {
		success: true,
		message: "Queued deployment cancellation requested",
	};
};

export type QueueJobRow = {
	id: string;
	name?: string;
	data: Record<string, unknown>;
	timestamp?: number;
	processedOn?: number;
	finishedOn?: number;
	failedReason?: string;
	state: string;
};

export const fetchDeployApiJobs = async (
	runtimeWorkerId: string,
): Promise<QueueJobRow[]> => {
	const jobs = await myQueue.getJobs();
	const rows = await Promise.all(
		jobs
			.filter((job) => job.data.runtimeWorkerId === runtimeWorkerId)
			.map(async (job) => ({
				id: String(job.id),
				name: job.name ?? undefined,
				data: job.data as unknown as Record<string, unknown>,
				timestamp: job.timestamp,
				processedOn: job.processedOn,
				finishedOn: job.finishedOn,
				failedReason: job.failedReason ?? undefined,
				state: await job.getState(),
			})),
	);
	return rows.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
};
