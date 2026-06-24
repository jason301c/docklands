"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import copy from "copy-to-clipboard";
import { HelpCircle, ServerOff } from "lucide-react";
import { toast } from "@/components/shared/toast";

type RuntimeServer = {
	ipAddress?: string | null;
	runtimeWorkerStatus?: string | null;
};

type RuntimePlacementStatusProps = {
	fallbackIp?: string | null;
	runtimeWorker?: RuntimeServer | null;
	runtimeWorkerId?: string | null;
};

export const runtimePlacementLabel = ({
	runtimeWorker,
	runtimeWorkerId,
}: Pick<RuntimePlacementStatusProps, "runtimeWorker" | "runtimeWorkerId">) => {
	if (!runtimeWorkerId) return "Automatic placement";
	if (runtimeWorker?.runtimeWorkerStatus === "inactive")
		return "Runtime worker inactive";
	return "Runtime worker";
};

export const RuntimePlacementStatus = ({
	fallbackIp,
	runtimeWorker,
	runtimeWorkerId,
}: RuntimePlacementStatusProps) => {
	const address = runtimeWorker?.ipAddress || fallbackIp;
	const label = runtimePlacementLabel({ runtimeWorker, runtimeWorkerId });
	const inactive = runtimeWorker?.runtimeWorkerStatus === "inactive";

	return (
		<div className="flex flex-row h-fit w-fit gap-2">
			<Button
				type="button"
				size="xs"
				className="cursor-pointer"
				aria-label={address ? `Copy ${label.toLowerCase()} address` : label}
				onClick={() => {
					if (address) {
						copy(address);
						toast.success("Runtime worker address copied");
					}
				}}
				variant={inactive ? "destructive" : "secondary"}
			>
				{label}
			</Button>
			{inactive && (
				<TooltipProvider delay={0}>
					<Tooltip
						content={
							<span>
								This runtime worker is inactive. Re-enable runtime workers from
								Settings to run this service.
							</span>
						}
						className="w-[300px]"
						align="start"
						side="top"
						asChild
					>
						<Label className="break-all w-fit flex flex-row gap-1 items-center">
							<HelpCircle className="size-4 text-kumo-subtle" />
						</Label>
					</Tooltip>
				</TooltipProvider>
			)}
		</div>
	);
};

export const RuntimeWorkerInactiveState = () => (
	<div className="flex h-[55vh] border-2 rounded-xl border-dashed p-4">
		<div className="max-w-3xl mx-auto flex flex-col items-center justify-center self-center gap-3">
			<ServerOff className="size-10 text-kumo-subtle self-center" />
			<span className="text-center text-base text-kumo-subtle">
				This service's runtime worker is currently marked inactive. Re-enable
				runtime workers from Settings to regain access to this service.
			</span>
		</div>
	</div>
);
