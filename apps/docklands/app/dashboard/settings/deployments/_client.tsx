"use client";

import { api } from "@/client/api/trpc";
import { BuildsConcurrency } from "@/components/dashboard/settings/servers/actions/builds-concurrency";
import { AlertBlock } from "@/components/shared/alert-block";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";

const Page = () => {
	const { data: servers } = api.server.all.useQuery();

	return (
		<div className="w-full">
			<div className="h-full rounded-xl max-w-5xl mx-auto flex flex-col gap-4">
				<LayerCard className="h-full bg-sidebar p-2.5 rounded-xl mx-auto w-full">
					<div className="rounded-xl bg-background shadow-md">
						<div>
							<h3 className="text-xl">Concurrent Builds</h3>
							<p>
								Configure how many deployments can build at the same time on
								each server. Builds of the same service are always serialized.
							</p>
						</div>
						<div className="flex flex-col gap-6">
							<AlertBlock type="warning">
								Running multiple builds at once increases CPU, memory and disk
								usage on each server. Each concurrent build runs its own builder
								and image build, so set this based on the resources the machine
								can handle — too high a value can exhaust memory and make
								deployments fail.
							</AlertBlock>
							<div className="flex flex-col gap-2">
								<p className="text-sm font-medium text-muted-foreground">
									Docklands Server
								</p>
								<BuildsConcurrency />
							</div>

							<div className="flex flex-col gap-2">
								<p className="text-sm font-medium text-muted-foreground">
									Remote Servers
								</p>
								{servers && servers.length > 0 ? (
									<div className="flex flex-col gap-3">
										{servers.map((server) => (
											<BuildsConcurrency
												key={server.serverId}
												serverId={server.serverId}
												label={server.name}
											/>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
										No remote servers added yet.
									</p>
								)}
							</div>
						</div>
					</div>
				</LayerCard>
			</div>
		</div>
	);
};

export default Page;
