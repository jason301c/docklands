import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import copy from "copy-to-clipboard";
import { CopyIcon, ServerIcon } from "lucide-react";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";
import { RuntimeUpdateDialog } from "./ingress-runtime/runtime-update-dialog";
import { ShowDocklandsActions } from "./runtime/actions/show-docklands-actions";
import { ShowIngressActions } from "./runtime/actions/show-ingress-actions";
import { ShowStorageActions } from "./runtime/actions/show-storage-actions";
import { ToggleDockerCleanup } from "./runtime/actions/toggle-docker-cleanup";

export const IngressRuntime = () => {
	const { data: ingressSettings } =
		api.settings.getWebServerSettings.useQuery();

	const { data: docklandsVersion } =
		api.settings.getDocklandsVersion.useQuery();

	return (
		<div className="w-full">
			<LayerCard className="h-full w-full">
				<div>
					<h3 className="text-xl flex flex-row gap-2">
						<ServerIcon className="size-6 text-muted-foreground self-center" />
						Ingress Runtime
					</h3>
					<p>
						Reload the edge proxy, clean runtime state, and inspect updates.
					</p>
				</div>
				<div className="space-y-6 py-6 border-t">
					<div className="grid md:grid-cols-2 gap-4">
						<ShowDocklandsActions />
						<ShowIngressActions />
						<ShowStorageActions />

						<RuntimeUpdateDialog />
					</div>

					<div className="flex items-center flex-wrap justify-between gap-4">
						<span className="text-sm text-muted-foreground flex items-center gap-1.5">
							Public IP: {ingressSettings?.serverIp}
							{ingressSettings?.serverIp && (
								<CopyIcon
									className="size-3.5 cursor-pointer hover:text-foreground transition-colors"
									onClick={() => {
										copy(ingressSettings.serverIp ?? "");
										toast.success("Copied to clipboard");
									}}
								/>
							)}
						</span>
						<span className="text-sm text-muted-foreground">
							Version: {docklandsVersion}
						</span>

						<ToggleDockerCleanup />
					</div>
				</div>
			</LayerCard>
		</div>
	);
};
