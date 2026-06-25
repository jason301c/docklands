import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

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

const readinessFilePath = () => {
	const explicitPath = process.env.DOCKLANDS_READINESS_FILE?.trim();
	if (explicitPath) {
		return explicitPath;
	}

	return process.env.NODE_ENV === "production"
		? "/tmp/docklands/readiness.json"
		: undefined;
};

const isReadinessPhase = (value: unknown): value is ReadinessPhase =>
	value === "starting" || value === "ready" || value === "degraded";

const isReadinessStepStatus = (value: unknown): value is ReadinessStepStatus =>
	value === "running" || value === "ok" || value === "failed";

const isReadinessStep = (value: unknown): value is ReadinessStep => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const step = value as Partial<ReadinessStep>;
	return (
		typeof step.name === "string" &&
		typeof step.critical === "boolean" &&
		isReadinessStepStatus(step.status) &&
		typeof step.updatedAt === "string" &&
		(step.error === undefined || typeof step.error === "string")
	);
};

const isReadinessSnapshot = (value: unknown): value is ReadinessSnapshot => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const snapshot = value as Partial<ReadinessSnapshot>;
	return (
		typeof snapshot.ok === "boolean" &&
		isReadinessPhase(snapshot.phase) &&
		typeof snapshot.updatedAt === "string" &&
		Array.isArray(snapshot.failedCriticalSteps) &&
		snapshot.failedCriticalSteps.every((step) => typeof step === "string") &&
		Array.isArray(snapshot.steps) &&
		snapshot.steps.every(isReadinessStep)
	);
};

const touch = () => {
	updatedAt = new Date().toISOString();
};

const warnReadinessFile = (
	message: string,
	error: unknown,
	filePath: string,
) => {
	const errorMessage = error instanceof Error ? error.message : String(error);
	process.stderr.write(
		`[readiness] ${message}: ${errorMessage} (${filePath})\n`,
	);
};

const getMemoryReadinessSnapshot = (): ReadinessSnapshot => {
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

const persistReadinessSnapshot = () => {
	const filePath = readinessFilePath();
	if (!filePath) {
		return;
	}

	try {
		mkdirSync(dirname(/* turbopackIgnore: true */ filePath), {
			recursive: true,
		});
		const tempPath = `${filePath}.${process.pid}.tmp`;
		writeFileSync(
			/* turbopackIgnore: true */ tempPath,
			`${JSON.stringify(getMemoryReadinessSnapshot())}\n`,
			"utf8",
		);
		renameSync(
			/* turbopackIgnore: true */ tempPath,
			/* turbopackIgnore: true */ filePath,
		);
	} catch (error) {
		warnReadinessFile("Failed to persist readiness snapshot", error, filePath);
	}
};

const readPersistedReadinessSnapshot = () => {
	const filePath = readinessFilePath();
	if (!filePath || !existsSync(/* turbopackIgnore: true */ filePath)) {
		return undefined;
	}

	try {
		const snapshot = JSON.parse(
			readFileSync(/* turbopackIgnore: true */ filePath, "utf8"),
		);
		return isReadinessSnapshot(snapshot) ? snapshot : undefined;
	} catch (error) {
		warnReadinessFile("Failed to read readiness snapshot", error, filePath);
		return undefined;
	}
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
	persistReadinessSnapshot();
};

export const markReadinessStepRunning = (
	name: string,
	options: { critical?: boolean } = {},
) => {
	upsertStep(name, "running", options);
	persistReadinessSnapshot();
};

export const markReadinessStepOk = (name: string) => {
	upsertStep(name, "ok");
	persistReadinessSnapshot();
};

export const markReadinessStepFailed = (
	name: string,
	error: unknown,
	options: { critical?: boolean } = {},
) => {
	upsertStep(name, "failed", { ...options, error });
	updatePhase();
	persistReadinessSnapshot();
};

export const markReadinessComplete = () => {
	bootstrapComplete = true;
	updatePhase();
	persistReadinessSnapshot();
};

export const getReadinessSnapshot = (
	options: { preferPersisted?: boolean } = {},
): ReadinessSnapshot => {
	if (options.preferPersisted) {
		const persistedSnapshot = readPersistedReadinessSnapshot();
		if (persistedSnapshot) {
			return persistedSnapshot;
		}
	}

	return getMemoryReadinessSnapshot();
};

export const resetReadinessForTests = (nextPhase: ReadinessPhase = "ready") => {
	phase = nextPhase;
	bootstrapComplete = nextPhase === "ready";
	steps.clear();
	touch();
	const filePath = readinessFilePath();
	if (filePath) {
		rmSync(/* turbopackIgnore: true */ filePath, { force: true });
	}
};
