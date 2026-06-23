import { createLogger } from "@/server/core/lib/logger";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";
import { resolveBuildsConcurrency } from "./concurrency";
import { processDeploymentJob } from "./deployments-queue";
import { type InMemoryJob, InMemoryQueue } from "./in-memory-queue";
import type { DeploymentJob } from "./queue-types";

const logger = createLogger("deploy-queue");

/**
 * Deployment queue.
 *
 * An in-memory, per-group FIFO queue with configurable concurrency per
 * runtimeWorker.
 */

interface DeploymentQueue {
	add: (
		name: string,
		data: DeploymentJob,
		opts?: Record<string, unknown>,
	) => Promise<{ id: string }>;
	getJobs: (states?: Array<"waiting" | "active">) => Promise<InMemoryJob[]>;
	close: () => Promise<void>;
	on: (...args: unknown[]) => void;
	run: () => Promise<void>;
	removeWaiting: (predicate: (data: DeploymentJob) => boolean) => number;
	clearWaiting: () => number;
}

const createInMemoryQueue = (): DeploymentQueue => {
	const queue = new InMemoryQueue({
		resolveConcurrency: resolveBuildsConcurrency,
	});
	queue.process(processDeploymentJob);

	return {
		add: (_name, data) => queue.add(data),
		getJobs: (states) => queue.getJobs(states),
		close: () => queue.close(),
		on: () => {},
		run: () => queue.run(),
		removeWaiting: (predicate) => queue.removeWaiting(predicate),
		clearWaiting: () => queue.clearWaiting(),
	};
};

// Use a global singleton so the deployment queue is shared across every module
// instance. In dev (tsx/Next) the same file can be evaluated more than once
// (relative import in runtimeWorker.ts vs `@/` alias in the routers); without this the
// worker and the `add()` calls would land on different queue instances.
const globalForQueue = globalThis as unknown as {
	__docklandsDeploymentQueue?: DeploymentQueue;
};

if (!globalForQueue.__docklandsDeploymentQueue) {
	globalForQueue.__docklandsDeploymentQueue = createInMemoryQueue();
}

const myQueue: DeploymentQueue = globalForQueue.__docklandsDeploymentQueue;

/** Start processing jobs. Called once on runtimeWorker startup. */
export const startDeploymentWorker = () => myQueue.run();

export const getJobsByApplicationId = async (applicationId: string) => {
	const jobs = await myQueue.getJobs();
	return jobs.filter(
		(job) => (job.data as any)?.applicationId === applicationId,
	);
};

export const getJobsByComposeId = async (composeId: string) => {
	const jobs = await myQueue.getJobs();
	return jobs.filter((job) => (job.data as any)?.composeId === composeId);
};

process.on("SIGTERM", () => {
	logger.info("SIGTERM received, closing deployment queue");
	myQueue.close();
	process.exit(0);
});

export const cleanQueuesByApplication = async (applicationId: string) => {
	const removed = myQueue.removeWaiting(
		(data) => (data as any)?.applicationId === applicationId,
	);
	if (removed > 0) {
		logger.info({ applicationId, removed }, "queue cleared for application");
	}
};

export const cleanQueuesByCompose = async (composeId: string) => {
	const removed = myQueue.removeWaiting(
		(data) => (data as any)?.composeId === composeId,
	);
	if (removed > 0) {
		logger.info({ composeId, removed }, "queue cleared for compose");
	}
};

export const cleanAllDeploymentQueue = async () => {
	myQueue.clearWaiting();
	return true;
};

export const killDockerBuild = async (
	type: "application" | "compose",
	runtimeWorkerId: string | null,
) => {
	try {
		if (type === "application") {
			const command = `pkill -2 -f "docker build"`;

			if (runtimeWorkerId) {
				await execAsyncRemote(runtimeWorkerId, command);
			} else {
				await execAsync(command);
			}
		} else if (type === "compose") {
			const command = `pkill -2 -f "docker compose"`;

			if (runtimeWorkerId) {
				await execAsyncRemote(runtimeWorkerId, command);
			} else {
				await execAsync(command);
			}
		}
	} catch (error) {
		logger.error(
			{ err: error, type, runtimeWorkerId },
			"kill docker build failed",
		);
	}
};

export { myQueue };
