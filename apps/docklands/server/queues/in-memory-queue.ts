import { createLogger } from "@/server/core/lib/logger";
import type { DeploymentJob } from "./queue-types";

const logger = createLogger("queue");

/**
 * In-memory deployment queue for self-hosted instances.
 *
 * Replaces BullMQ/Redis for deployments. The model is per-group FIFO with a
 * configurable concurrency per partition (runtimeWorker):
 *
 * - Jobs are partitioned by `runtimeWorkerId` (the local web server uses the
 *   `LOCAL_PARTITION` key). Each partition runs up to `concurrency` jobs at
 *   the same time, so two different applications can build concurrently.
 * - Within a partition, jobs that belong to the same group (same application
 *   or compose) never run in parallel — they are serialized FIFO. This avoids
 *   two builds of the same service stepping on each other (same code dir,
 *   same container name, etc).
 *
 * The concurrency is resolved lazily per partition through `resolveConcurrency`
 * so runtime settings changes can take effect without restarting the worker.
 *
 * The public surface (`add`, `getJobs`, `close`, `on`) mirrors the subset of
 * BullMQ used by the routers so it can be a drop-in replacement.
 */

export const LOCAL_PARTITION = "__local__";

export type JobState = "waiting" | "active";

export interface InMemoryJob {
	id: string;
	name: string;
	data: DeploymentJob;
	timestamp: number;
	processedOn?: number;
	finishedOn?: number;
	failedReason?: string;
	getState: () => Promise<JobState>;
	remove: () => Promise<void>;
}

type Processor = (job: InMemoryJob) => Promise<void>;

/** Resolve the partition key (runtimeWorkerId) a job belongs to. */
export const getPartition = (data: DeploymentJob): string =>
	data.runtimeWorkerId ?? LOCAL_PARTITION;

/** Resolve the FIFO group a job belongs to (the service being deployed). */
export const getGroup = (data: DeploymentJob): string => {
	if (data.applicationType === "compose") {
		return `compose:${data.composeId}`;
	}
	return `application:${data.applicationId}`;
};

interface InternalJob {
	id: string;
	name: string;
	data: DeploymentJob;
	timestamp: number;
	processedOn?: number;
	finishedOn?: number;
	failedReason?: string;
	state: JobState;
	partition: string;
	group: string;
}

interface Partition {
	waiting: InternalJob[];
	/** Groups currently running in this partition. */
	activeGroups: Set<string>;
	active: InternalJob[];
}

export interface InMemoryQueueOptions {
	/**
	 * Returns the max number of jobs that may run in parallel for a given
	 * partition. Called on every scheduling tick so config changes are
	 * picked up without restarting the queue. Must return a value >= 1.
	 */
	resolveConcurrency: (partition: string) => Promise<number> | number;
	/** Monotonic clock; injectable for tests. Defaults to Date.now. */
	now?: () => number;
}

export class InMemoryQueue {
	private partitions = new Map<string, Partition>();
	private processor: Processor | null = null;
	private running = false;
	private seq = 0;
	/** In-flight runJob promises, tracked so drain() can await them. */
	private activeRuns = new Set<Promise<void>>();
	private readonly resolveConcurrency: InMemoryQueueOptions["resolveConcurrency"];
	private readonly now: () => number;

	constructor(options: InMemoryQueueOptions) {
		this.resolveConcurrency = options.resolveConcurrency;
		this.now = options.now ?? (() => Date.now());
	}

	private getPartitionState(key: string): Partition {
		let partition = this.partitions.get(key);
		if (!partition) {
			partition = { waiting: [], activeGroups: new Set(), active: [] };
			this.partitions.set(key, partition);
		}
		return partition;
	}

	/**
	 * Register the worker that processes each job. Registering a processor also
	 * starts the queue: in dev (tsx/Next) the module that calls `run()` and the
	 * module that calls `add()` can resolve to different instances, so we must
	 * not depend on a separate `run()` call to flip `running` on.
	 */
	process(processor: Processor) {
		this.processor = processor;
		this.running = true;
		this.schedule();
	}

	run() {
		this.running = true;
		this.schedule();
		return Promise.resolve();
	}

	async add(data: DeploymentJob): Promise<{ id: string }> {
		const id = `job-${++this.seq}`;
		const partitionKey = getPartition(data);
		const group = getGroup(data);
		const job: InternalJob = {
			id,
			name: "deployments",
			data,
			timestamp: this.now(),
			state: "waiting",
			partition: partitionKey,
			group,
		};
		this.getPartitionState(partitionKey).waiting.push(job);
		logger.debug(
			{ jobId: id, partition: partitionKey, group, type: data.type },
			"deployment job queued",
		);
		this.schedule();
		return { id };
	}

	private toPublic(job: InternalJob): InMemoryJob {
		return {
			id: job.id,
			name: job.name,
			data: job.data,
			timestamp: job.timestamp,
			processedOn: job.processedOn,
			finishedOn: job.finishedOn,
			getState: () => Promise.resolve(job.state),
			remove: () => this.remove(job.id),
		};
	}

	/** Snapshot of jobs in the requested states (defaults to waiting + active). */
	getJobs(states?: JobState[]): Promise<InMemoryJob[]> {
		const wantWaiting = !states || states.includes("waiting");
		const wantActive = !states || states.includes("active");
		const jobs: InMemoryJob[] = [];
		for (const partition of this.partitions.values()) {
			if (wantWaiting) {
				jobs.push(...partition.waiting.map((job) => this.toPublic(job)));
			}
			if (wantActive) {
				jobs.push(...partition.active.map((job) => this.toPublic(job)));
			}
		}
		return Promise.resolve(jobs);
	}

	/** Remove a single waiting job by id. Active jobs cannot be removed. */
	remove(id: string): Promise<void> {
		for (const partition of this.partitions.values()) {
			const before = partition.waiting.length;
			partition.waiting = partition.waiting.filter((job) => job.id !== id);
			if (partition.waiting.length !== before) break;
		}
		return Promise.resolve();
	}

	/** Remove waiting jobs matching a predicate. Active jobs are not affected. */
	removeWaiting(predicate: (data: DeploymentJob) => boolean): number {
		let removed = 0;
		for (const partition of this.partitions.values()) {
			partition.waiting = partition.waiting.filter((job) => {
				const match = predicate(job.data);
				if (match) removed++;
				return !match;
			});
		}
		return removed;
	}

	/** Drop every waiting job across all partitions. */
	clearWaiting(): number {
		let removed = 0;
		for (const partition of this.partitions.values()) {
			removed += partition.waiting.length;
			partition.waiting = [];
		}
		return removed;
	}

	on() {
		// No-op: kept for BullMQ API compatibility (error events, etc).
	}

	close() {
		this.running = false;
		return Promise.resolve();
	}

	/**
	 * Graceful shutdown: stop scheduling new jobs and await in-flight ones, up to
	 * `timeoutMs`. Jobs still running after the timeout are abandoned; their DB
	 * rows are reconciled on the next boot.
	 */
	async drain(timeoutMs = 30_000): Promise<void> {
		this.running = false;
		if (this.activeRuns.size === 0) return;
		logger.info(
			{ active: this.activeRuns.size, timeoutMs },
			"draining in-flight deployment jobs",
		);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<void>((resolve) => {
			timer = setTimeout(resolve, timeoutMs);
		});
		await Promise.race([Promise.allSettled([...this.activeRuns]), timeout]);
		if (timer) clearTimeout(timer);
	}

	private schedule() {
		if (!this.running || !this.processor) return;
		for (const key of this.partitions.keys()) {
			void this.drainPartition(key);
		}
	}

	private async drainPartition(key: string) {
		const partition = this.partitions.get(key);
		if (!partition || !this.processor) return;

		const concurrency = Math.max(1, await this.resolveConcurrency(key));

		while (partition.active.length < concurrency) {
			// First waiting job whose group is not already running.
			const index = partition.waiting.findIndex(
				(job) => !partition.activeGroups.has(job.group),
			);
			if (index === -1) break;

			const job = partition.waiting.splice(index, 1)[0];
			if (!job) break;
			job.state = "active";
			job.processedOn = this.now();
			partition.activeGroups.add(job.group);
			partition.active.push(job);

			logger.info(
				{ jobId: job.id, partition: key, group: job.group },
				"deployment job started",
			);
			const run = this.runJob(job);
			this.activeRuns.add(run);
			void run.finally(() => this.activeRuns.delete(run));
		}
	}

	private async runJob(job: InternalJob) {
		const startedAt = this.now();
		try {
			await this.processor?.(this.toPublic(job));
		} catch (error) {
			job.failedReason = error instanceof Error ? error.message : String(error);
			logger.error(
				{
					err: error,
					jobId: job.id,
					partition: job.partition,
					group: job.group,
				},
				"deployment job failed",
			);
		} finally {
			job.finishedOn = this.now();
			const duration = job.finishedOn - startedAt;
			logger.info(
				{
					jobId: job.id,
					partition: job.partition,
					group: job.group,
					durationMs: duration,
				},
				"deployment job finished",
			);
			const partition = this.partitions.get(job.partition);
			if (partition) {
				partition.active = partition.active.filter((j) => j.id !== job.id);
				partition.activeGroups.delete(job.group);
			}
			// A slot (and possibly the group) freed up — try to schedule more.
			void this.drainPartition(job.partition);
		}
	}
}
