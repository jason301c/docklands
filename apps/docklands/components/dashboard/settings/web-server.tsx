import copy from "copy-to-clipboard";
import { CopyIcon, ServerIcon } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ShowDocklandsActions } from "./servers/actions/show-docklands-actions";
import { ShowStorageActions } from "./servers/actions/show-storage-actions";
import { ShowTraefikActions } from "./servers/actions/show-traefik-actions";
import { ToggleDockerCleanup } from "./servers/actions/toggle-docker-cleanup";
import { UpdateServer } from "./web-server/update-server";

export const WebServer = () => {
	const { data: webServerSettings } =
		api.settings.getWebServerSettings.useQuery();

	const { data: docklandsVersion } =
		api.settings.getDocklandsVersion.useQuery();

	return (
		<div className="w-full">
			{/* <LayerCard className={cn("rounded-lg w-full bg-transparent p-0", className)}></LayerCard> */}
			<LayerCard className="h-full bg-sidebar  p-2.5 rounded-xl  max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md ">
					<div className="">
						<h3 className="text-xl flex flex-row gap-2">
							<ServerIcon className="size-6 text-muted-foreground self-center" />
							Web Server
						</h3>
						<p>Reload or clean the web server.</p>
					</div>
					{/* <div>
						<h3 className="text-xl">
							Web Server
						</h3>
						<p>
							Reload or clean the web server.
						</p>
					</div> */}
					<div className="space-y-6 py-6 border-t">
						<div className="grid md:grid-cols-2 gap-4">
							<ShowDocklandsActions />
							<ShowTraefikActions />
							<ShowStorageActions />

							<UpdateServer />
						</div>

						<div className="flex items-center flex-wrap justify-between gap-4">
							<span className="text-sm text-muted-foreground flex items-center gap-1.5">
								Server IP: {webServerSettings?.serverIp}
								{webServerSettings?.serverIp && (
									<CopyIcon
										className="size-3.5 cursor-pointer hover:text-foreground transition-colors"
										onClick={() => {
											copy(webServerSettings.serverIp ?? "");
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
				</div>
			</LayerCard>
		</div>
	);
};
