"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import copy from "copy-to-clipboard";
import { HelpCircle, ServerOff } from "lucide-react";
import { toast } from "@/components/shared/toast";

type RuntimeServer = {
	ipAddress?: string | null;
	serverStatus?: string | null;
};

type RuntimePlacementStatusProps = {
	fallbackIp?: string | null;
	server?: RuntimeServer | null;
	serverId?: string | null;
};

export const runtimePlacementLabel = ({
	server,
	serverId,
}: Pick<RuntimePlacementStatusProps, "server" | "serverId">) => {
	if (!serverId) return "Automatic placement";
	if (server?.serverStatus === "inactive") return "Runtime worker inactive";
	return "Runtime worker";
};

export const RuntimePlacementStatus = ({
	fallbackIp,
	server,
	serverId,
}: RuntimePlacementStatusProps) => {
	const address = server?.ipAddress || fallbackIp;
	const label = runtimePlacementLabel({ server, serverId });
	const inactive = server?.serverStatus === "inactive";

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
						className="z-[999] w-[300px]"
						align="start"
						side="top"
						asChild
					>
						<Label className="break-all w-fit flex flex-row gap-1 items-center">
							<HelpCircle className="size-4 text-muted-foreground" />
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
			<ServerOff className="size-10 text-muted-foreground self-center" />
			<span className="text-center text-base text-muted-foreground">
				This service's runtime worker is currently marked inactive. Re-enable
				runtime workers from Settings to regain access to this service.
			</span>
		</div>
	</div>
);
