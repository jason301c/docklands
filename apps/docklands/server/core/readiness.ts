type ReadinessPhase = "starting" | "ready" | "degraded";
type ReadinessStepStatus = "running" | "ok" | "failed";

export interface ReadinessStep {
	critical: boolean;
	error?: string;
	name: string;
	status: ReadinessStepStatus;
	updatedAt: string;
}

export interface ReadinessSnapshot {
	failedCriticalSteps: string[];
	ok: boolean;
	phase: ReadinessPhase;
	steps: ReadinessStep[];
	updatedAt: string;
}

const defaultPhase = (): ReadinessPhase =>
	process.env.NODE_ENV === "production" ? "starting" : "ready";

let phase: ReadinessPhase = defaultPhase();
let updatedAt = new Date().toISOString();
let bootstrapComplete = phase === "ready";
const steps = new Map<string, ReadinessStep>();

const touch = () => {
	updatedAt = new Date().toISOString();
};

const upsertStep = (
	name: string,
	status: ReadinessStepStatus,
	options: { critical?: boolean; error?: unknown } = {},
) => {
	const existing = steps.get(name);
	const step: ReadinessStep = {
		critical: options.critical ?? existing?.critical ?? true,
		error: options.error ? String(options.error) : undefined,
		name,
		status,
		updatedAt: new Date().toISOString(),
	};

	steps.set(name, step);
	touch();
};

const updatePhase = () => {
	const failedCriticalSteps = [...steps.values()].filter(
		(step) => step.critical && step.status === "failed",
	);

	phase =
		failedCriticalSteps.length > 0
			? "degraded"
			: bootstrapComplete
				? "ready"
				: "starting";
	touch();
};

export const markReadinessStarting = () => {
	phase = "starting";
	bootstrapComplete = false;
	steps.clear();
	touch();
};

export const markReadinessStepRunning = (
	name: string,
	options: { critical?: boolean } = {},
) => {
	upsertStep(name, "running", options);
};

export const markReadinessStepOk = (name: string) => {
	upsertStep(name, "ok");
};

export const markReadinessStepFailed = (
	name: string,
	error: unknown,
	options: { critical?: boolean } = {},
) => {
	upsertStep(name, "failed", { ...options, error });
	updatePhase();
};

export const markReadinessComplete = () => {
	bootstrapComplete = true;
	updatePhase();
};

export const getReadinessSnapshot = (): ReadinessSnapshot => {
	const orderedSteps = [...steps.values()].sort((a, b) =>
		a.name.localeCompare(b.name),
	);
	const failedCriticalSteps = orderedSteps
		.filter((step) => step.critical && step.status === "failed")
		.map((step) => step.name);

	return {
		failedCriticalSteps,
		ok: phase === "ready" && failedCriticalSteps.length === 0,
		phase,
		steps: orderedSteps,
		updatedAt,
	};
};

export const resetReadinessForTests = (nextPhase: ReadinessPhase = "ready") => {
	phase = nextPhase;
	bootstrapComplete = nextPhase === "ready";
	steps.clear();
	touch();
};
