"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Boxes, ExternalLink, Rocket, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { AlertBlock } from "@/components/shared/alert-block";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { Dialog } from "@/components/shared/dialog";
import { DialogAction } from "@/components/shared/dialog-action";
import { DeploymentLogStream } from "@/components/shared/logs/deployment-log-stream";
import {
	type DeploymentRow,
	deploymentDurationSeconds,
	formatDurationSeconds,
	getDeploymentTrigger,
	getDeploymentWorker,
	getServiceInfo,
	statusDotClass,
	statusLabel,
	statusVariants,
} from "./deployments-columns";

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-xs uppercase tracking-wide text-kumo-subtle">
				{label}
			</span>
			<span className="text-sm text-kumo-default">{children}</span>
		</div>
	);
}

/**
 * Live elapsed time for a running deployment (no `finishedAt` yet). Ticks every
 * second while the drawer is open so an in-flight build shows a moving timer.
 */
function useElapsedSeconds(startedAt: string | null, active: boolean) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [active]);
	if (!startedAt) return null;
	const seconds = Math.floor((now - new Date(startedAt).getTime()) / 1000);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

interface Props {
	deployment: DeploymentRow | null;
	open: boolean;
	onClose: () => void;
}

export function DeploymentDetailDrawer({ deployment, open, onClose }: Props) {
	const utils = api.useUtils();

	const { mutate: killProcess, isPending: isKilling } =
		api.deployment.killProcess.useMutation(
			crudMutationOptions({
				successMessage: "Process killed successfully",
				errorMessage: "Error killing process",
				loggerScope: "deployments",
				invalidate: () => utils.deployment.allCentralizedPaged.invalidate(),
			}),
		);

	const { mutate: removeDeployment, isPending: isRemoving } =
		api.deployment.removeDeployment.useMutation(
			crudMutationOptions({
				successMessage: "Deployment record deleted",
				errorMessage: "Error deleting deployment record",
				loggerScope: "deployments",
				invalidate: () => utils.deployment.allCentralizedPaged.invalidate(),
				onSuccess: () => onClose(),
			}),
		);

	const status = deployment?.status ?? "running";
	const isRunning = status === "running";
	const elapsed = useElapsedSeconds(
		deployment?.startedAt ?? null,
		open && isRunning,
	);

	const info = deployment ? getServiceInfo(deployment) : null;
	const trigger = deployment ? getDeploymentTrigger(deployment) : null;
	const worker = deployment ? getDeploymentWorker(deployment) : null;
	const finishedSeconds = deploymentDurationSeconds(
		deployment?.startedAt,
		deployment?.finishedAt,
	);
	const durationText =
		finishedSeconds !== null
			? formatDurationSeconds(finishedSeconds)
			: isRunning && elapsed !== null
				? `${formatDurationSeconds(elapsed)} (running)`
				: "—";

	const canDelete = status === "done" || status === "error";
	const canKill = isRunning && Boolean(deployment?.pid);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<Dialog className="flex max-h-[90vh] flex-col gap-4 sm:max-w-4xl">
				{deployment ? (
					<>
						<Dialog.Header className="gap-3">
							<div className="flex flex-wrap items-center gap-2">
								<span
									className={`size-2.5 shrink-0 rounded-full ${
										statusDotClass[status] ?? statusDotClass.cancelled
									} ${isRunning ? "animate-pulse" : ""}`}
									aria-hidden="true"
								/>
								<Dialog.Title className="flex items-center gap-2">
									{info?.type === "Compose" ? (
										<Boxes className="size-4 text-kumo-subtle" />
									) : (
										<Rocket className="size-4 text-kumo-subtle" />
									)}
									{info?.name ?? "Deployment"}
								</Dialog.Title>
								<Badge variant={statusVariants[status] ?? "secondary"}>
									{statusLabel[status] ?? status}
								</Badge>
								{trigger && (
									<Badge variant={trigger.variant}>{trigger.label}</Badge>
								)}
							</div>
							<Dialog.Description>
								{info
									? `${info.workspaceName} / ${info.environmentName}`
									: "Service metadata unavailable"}
							</Dialog.Description>
						</Dialog.Header>

						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
							<MetaItem label="Created">
								<DateTooltip date={deployment.createdAt} />
							</MetaItem>
							<MetaItem label="Duration">{durationText}</MetaItem>
							<MetaItem label="Worker">{worker ?? "Local"}</MetaItem>
							{deployment.title && (
								<MetaItem label="Title">
									<span className="break-words">{deployment.title}</span>
								</MetaItem>
							)}
							{deployment.description && (
								<MetaItem label="Commit / detail">
									<span className="break-words font-mono text-xs">
										{deployment.description}
									</span>
								</MetaItem>
							)}
							<MetaItem label="Deployment ID">
								<span className="font-mono text-xs">
									{deployment.deploymentId}
								</span>
							</MetaItem>
						</div>

						{deployment.status === "error" && deployment.errorMessage && (
							<AlertBlock type="error">{deployment.errorMessage}</AlertBlock>
						)}

						<div className="flex flex-wrap items-center gap-2">
							{info && (
								<LinkButton href={info.href} variant="secondary" size="sm">
									<ExternalLink className="size-4" />
									Open service
								</LinkButton>
							)}
							{canKill && (
								<DialogAction
									title="Kill Process"
									description="Are you sure you want to kill the running deployment process?"
									type="destructive"
									onClick={() =>
										killProcess({ deploymentId: deployment.deploymentId })
									}
								>
									<Button variant="destructive" size="sm" loading={isKilling}>
										Kill process
									</Button>
								</DialogAction>
							)}
							{canDelete && (
								<DialogAction
									title="Delete deployment record"
									description="Are you sure you want to delete this deployment record? This action cannot be undone."
									type="destructive"
									onClick={() =>
										removeDeployment({ deploymentId: deployment.deploymentId })
									}
								>
									<Button variant="destructive" size="sm" loading={isRemoving}>
										Delete
										<Trash2 className="size-4" />
									</Button>
								</DialogAction>
							)}
						</div>

						<div className="min-h-0 flex-1 overflow-hidden">
							<DeploymentLogStream
								logPath={deployment.logPath || null}
								open={open}
								runtimeWorkerId={
									deployment.buildRuntimeWorkerId ||
									deployment.runtimeWorkerId ||
									undefined
								}
								errorMessage={deployment.errorMessage ?? undefined}
								scrollClassName="h-[45vh]"
							/>
						</div>
					</>
				) : null}
			</Dialog>
		</Dialog.Root>
	);
}
