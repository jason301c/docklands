"use client";

import type { RouterOutputs } from "@/client/api/trpc";
import { workspaceServicePath } from "@/shared/routes";

export type DeploymentRow =
	RouterOutputs["deployment"]["allCentralizedPaged"]["rows"][number];

export type DeploymentStatus = "running" | "done" | "error" | "cancelled";

type BadgeVariant =
	| "secondary"
	| "destructive"
	| "outline"
	| "neutral"
	| "warning"
	| "green"
	| "red";

/** Human-facing status labels (the raw enum reads oddly, e.g. "done"). */
export const statusLabel: Record<string, string> = {
	running: "Running",
	done: "Succeeded",
	error: "Failed",
	cancelled: "Cancelled",
};

export const statusVariants: Record<string, BadgeVariant> = {
	running: "warning",
	done: "green",
	error: "red",
	cancelled: "outline",
};

export const statusDotClass: Record<string, string> = {
	running: "bg-kumo-warning",
	done: "bg-kumo-success",
	error: "bg-kumo-danger",
	cancelled: "bg-kumo-fill",
};

export function getServiceInfo(d: DeploymentRow) {
	const app = d.application;
	const comp = d.compose;
	if (app?.environment?.workspace && app.environment) {
		return {
			type: "Application" as const,
			name: app.name,
			workspaceId: app.environment.workspace.workspaceId,
			environmentId: app.environment.environmentId,
			workspaceName: app.environment.workspace.name,
			environmentName: app.environment.name,
			serviceId: app.applicationId,
			href: workspaceServicePath({
				workspaceId: app.environment.workspace.workspaceId,
				environmentId: app.environment.environmentId,
				serviceType: "application",
				serviceId: app.applicationId,
			}),
		};
	}
	if (comp?.environment?.workspace && comp.environment) {
		return {
			type: "Compose" as const,
			name: comp.name,
			workspaceId: comp.environment.workspace.workspaceId,
			environmentId: comp.environment.environmentId,
			workspaceName: comp.environment.workspace.name,
			environmentName: comp.environment.name,
			serviceId: comp.composeId,
			href: workspaceServicePath({
				workspaceId: comp.environment.workspace.workspaceId,
				environmentId: comp.environment.environmentId,
				serviceType: "compose",
				serviceId: comp.composeId,
			}),
		};
	}
	return null;
}

/** Name of the runtime worker that ran a deployment, if any. */
export function getDeploymentWorker(d: DeploymentRow): string | null {
	return (
		d.application?.runtimeWorker?.name ??
		d.compose?.runtimeWorker?.name ??
		d.runtimeWorker?.name ??
		null
	);
}

/**
 * Classify *why* a deployment exists from its foreign keys. The centralized
 * timeline only surfaces application/compose deployments, so in practice this is
 * usually "Deployment" with the occasional "Rollback"; the remaining cases are
 * covered for completeness and future-proofing.
 */
export function getDeploymentTrigger(d: DeploymentRow): {
	label: string;
	variant: BadgeVariant;
} {
	if (d.rollbackId) return { label: "Rollback", variant: "secondary" };
	if (d.isPreviewDeployment || d.previewDeploymentId) {
		return { label: "Preview", variant: "outline" };
	}
	if (d.backupId) return { label: "Backup", variant: "outline" };
	if (d.volumeBackupId) return { label: "Volume backup", variant: "outline" };
	if (!d.applicationId && !d.composeId && d.runtimeWorkerId) {
		return { label: "Server", variant: "outline" };
	}
	return { label: "Deployment", variant: "neutral" };
}

/** Whole-second duration between start and finish, or null if not finished. */
export function deploymentDurationSeconds(
	startedAt: string | null | undefined,
	finishedAt: string | null | undefined,
): number | null {
	if (!startedAt || !finishedAt) return null;
	const seconds = Math.floor(
		(new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000,
	);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function formatDurationSeconds(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remSeconds = seconds % 60;
	if (minutes < 60) return `${minutes}m ${remSeconds}s`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	return `${hours}h ${remMinutes}m`;
}

export function formatDeploymentDuration(
	startedAt: string | null | undefined,
	finishedAt: string | null | undefined,
): string | null {
	const seconds = deploymentDurationSeconds(startedAt, finishedAt);
	return seconds === null ? null : formatDurationSeconds(seconds);
}
