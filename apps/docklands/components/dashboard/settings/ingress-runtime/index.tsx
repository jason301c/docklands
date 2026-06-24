import copy from "copy-to-clipboard";
import { CopyIcon, ServerIcon } from "lucide-react";
import { api } from "@/client/api/trpc";
import { SectionCard } from "@/components/shared/section-card";
import { toast } from "@/components/shared/toast";
import { ShowDocklandsActions } from "../runtime/actions/show-docklands-actions";
import { ShowIngressActions } from "../runtime/actions/show-ingress-actions";
import { ShowStorageActions } from "../runtime/actions/show-storage-actions";
import { ToggleDockerCleanup } from "../runtime/actions/toggle-docker-cleanup";
import { RuntimeUpdateDialog } from "./runtime-update-dialog";

export const IngressRuntime = () => {
	const { data: ingressSettings } =
		api.settings.getWebServerSettings.useQuery();

	const { data: docklandsVersion } =
		api.settings.getDocklandsVersion.useQuery();

	return (
		<SectionCard
			icon={ServerIcon}
			title="Ingress Runtime"
			description="Reload the edge proxy, clean runtime state, and inspect updates."
			contentClassName="space-y-6"
		>
			<div className="grid md:grid-cols-2 gap-4">
				<ShowDocklandsActions />
				<ShowIngressActions />
				<ShowStorageActions />

				<RuntimeUpdateDialog />
			</div>

			<div className="flex items-center flex-wrap justify-between gap-4">
				<span className="text-sm text-kumo-subtle flex items-center gap-1.5">
					Public IP: {ingressSettings?.serverIp}
					{ingressSettings?.serverIp && (
						<CopyIcon
							className="size-3.5 cursor-pointer hover:text-kumo-default transition-colors"
							onClick={() => {
								copy(ingressSettings.serverIp ?? "");
								toast.success("Copied to clipboard");
							}}
						/>
					)}
				</span>
				<span className="text-sm text-kumo-subtle">
					Version: {docklandsVersion}
				</span>

				<ToggleDockerCleanup />
			</div>
		</SectionCard>
	);
};
