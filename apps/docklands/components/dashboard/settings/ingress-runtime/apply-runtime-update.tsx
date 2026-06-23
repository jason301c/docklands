import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import {
	AlertTriangle,
	CheckCircle2,
	HardDriveDownload,
	Loader2,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("runtime-update");

type ServiceStatus = {
	status: "healthy" | "unhealthy";
	message?: string;
};

type HealthResult = {
	postgres: ServiceStatus;
	traefik: ServiceStatus;
};

type ModalState = "idle" | "checking" | "results" | "updating";

const ServiceStatusItem = ({
	name,
	service,
}: {
	name: string;
	service: ServiceStatus;
}) => (
	<div className="flex items-center gap-2">
		{service.status === "healthy" ? (
			<CheckCircle2 className="h-4 w-4 text-kumo-success" />
		) : (
			<XCircle className="h-4 w-4 text-kumo-danger" />
		)}
		<span className="text-sm font-medium">{name}</span>
		{service.status === "unhealthy" && service.message && (
			<span className="text-xs text-kumo-subtle">— {service.message}</span>
		)}
	</div>
);

export const ApplyRuntimeUpdate = () => {
	const [modalState, setModalState] = useState<ModalState>("idle");
	const [open, setOpen] = useState(false);
	const [healthResult, setHealthResult] = useState<HealthResult | null>(null);

	const { mutateAsync: updateServer } = api.settings.updateServer.useMutation();
	const { refetch: checkHealth } =
		api.settings.checkInfrastructureHealth.useQuery(undefined, {
			enabled: false,
		});

	const handleVerify = async () => {
		setModalState("checking");
		setHealthResult(null);

		try {
			const result = await checkHealth();
			if (result.data) {
				setHealthResult(result.data);
			}
		} catch (err) {
			logger.warn("health check failed:", err);
		}
		setModalState("results");
	};

	const allHealthy =
		healthResult &&
		healthResult.postgres.status === "healthy" &&
		healthResult.traefik.status === "healthy";

	const checkIsUpdateFinished = async () => {
		try {
			const response = await fetch("/api/health");
			if (!response.ok) {
				throw new Error("Health check failed");
			}

			toast.success(
				"The runtime has been updated. The page will be reloaded to reflect the changes...",
			);

			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} catch {
			logger.debug("runtime not yet healthy, retrying...");
			await new Promise((resolve) => setTimeout(resolve, 2000));
			void checkIsUpdateFinished();
		}
	};

	const handleConfirm = async () => {
		try {
			setModalState("updating");
			await updateServer();

			await new Promise((resolve) => setTimeout(resolve, 8000));

			await checkIsUpdateFinished();
		} catch (error) {
			setModalState("results");
			logger.error("Error updating runtime:", error);
			toast.error(
				"An error occurred while updating the runtime, please try again.",
			);
		}
	};

	const handleClose = () => {
		if (modalState !== "updating") {
			setOpen(false);
			setModalState("idle");
			setHealthResult(null);
		}
	};

	return (
		<Dialog.Root role="alertdialog" open={open}>
			<Dialog.Trigger
				render={
					<Button
						className="relative w-full"
						variant="secondary"
						onClick={() => setOpen(true)}
					>
						<HardDriveDownload className="h-4 w-4" />
						<span className="absolute -right-1 -top-2 flex h-3 w-3">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kumo-success opacity-75" />
							<span className="relative inline-flex rounded-full h-3 w-3 bg-kumo-success" />
						</span>
						Update Runtime
					</Button>
				}
			/>
			<Dialog>
				<div>
					<Dialog.Title>
						{modalState === "idle" && "Are you absolutely sure?"}
						{modalState === "checking" && "Verifying Services..."}
						{modalState === "results" &&
							(allHealthy ? "Ready to Update" : "Service Issues Detected")}
						{modalState === "updating" && "Runtime update in progress"}
					</Dialog.Title>
					<Dialog.Description>
						<div>
							{modalState === "idle" && (
								<span>
									This will update the Docklands runtime to the new version. You
									will not be able to use the panel during the update process.
									The page will be reloaded once the update is finished.
									<br />
									<br />
									We recommend verifying that all services are running before
									updating.
								</span>
							)}

							{modalState === "checking" && (
								<span className="flex items-center gap-2">
									<Loader2 className="animate-spin h-4 w-4" />
									Checking PostgreSQL and ingress...
								</span>
							)}

							{modalState === "results" && healthResult && (
								<div className="flex flex-col gap-3">
									<div className="flex flex-col gap-2">
										<ServiceStatusItem
											name="PostgreSQL"
											service={healthResult.postgres}
										/>
										<ServiceStatusItem
											name="Ingress"
											service={healthResult.traefik}
										/>
									</div>

									{!allHealthy && (
										<div className="flex items-start gap-2 rounded-md border border-kumo-warning/30 bg-kumo-warning-tint p-3">
											<AlertTriangle className="h-4 w-4 text-kumo-warning mt-0.5 shrink-0" />
											<span className="text-sm text-kumo-warning">
												Some services are not healthy. You can still proceed
												with the update.
											</span>
										</div>
									)}

									{allHealthy && (
										<span className="text-sm text-kumo-subtle">
											All services are running. You can proceed with the update.
										</span>
									)}
								</div>
							)}

							{modalState === "results" && !healthResult && (
								<div className="flex items-start gap-2 rounded-md border border-kumo-warning/30 bg-kumo-warning-tint p-3">
									<AlertTriangle className="h-4 w-4 text-kumo-warning mt-0.5 shrink-0" />
									<span className="text-sm text-kumo-warning">
										Could not verify services. You can still proceed with the
										update.
									</span>
								</div>
							)}

							{modalState === "updating" && (
								<span className="flex items-center gap-2">
									<Loader2 className="animate-spin h-4 w-4" />
									The runtime is being updated, please wait...
								</span>
							)}
						</div>
					</Dialog.Description>
				</div>
				{modalState === "idle" && (
					<div>
						<Dialog.Close onClick={handleClose}>Cancel</Dialog.Close>
						<Button variant="secondary" onClick={handleVerify}>
							<RefreshCw className="h-4 w-4" />
							Verify Status
						</Button>
						<Dialog.Close onClick={handleConfirm}>Confirm</Dialog.Close>
					</div>
				)}
				{modalState === "results" && (
					<div>
						<Dialog.Close onClick={handleClose}>Cancel</Dialog.Close>
						<Button variant="secondary" onClick={handleVerify}>
							<RefreshCw className="h-4 w-4" />
							Re-check
						</Button>
						<Dialog.Close onClick={handleConfirm}>
							{allHealthy ? "Confirm" : "Confirm Anyway"}
						</Dialog.Close>
					</div>
				)}
			</Dialog>
		</Dialog.Root>
	);
};
