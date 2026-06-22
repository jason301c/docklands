"use client";

import { api } from "@/client/api/trpc";
import { BuildsConcurrency } from "@/components/dashboard/settings/runtime/actions/builds-concurrency";
import { AlertBlock } from "@/components/shared/alert-block";

const Page = () => {
	const { data: servers } = api.runtimeWorker.all.useQuery();

	return (
		<div className="w-full">
			<div className="mx-auto flex h-full max-w-5xl flex-col gap-4 rounded-lg border bg-background p-6">
				<div>
					<h3 className="text-xl">Concurrent Builds</h3>
					<p>
						Configure how many builds can run at the same time on each runtime
						worker. Builds of the same service are always serialized.
					</p>
				</div>
				<div className="flex flex-col gap-6">
					<AlertBlock type="warning">
						Running multiple builds at once increases CPU, memory and disk usage
						on each runtime. Each concurrent build runs its own builder and
						image build, so set this based on the resources the runtime can
						handle. Too high a value can exhaust memory and make builds fail.
					</AlertBlock>
					<div className="flex flex-col gap-2">
						<p className="text-sm font-medium text-muted-foreground">
							Local runtime worker
						</p>
						<BuildsConcurrency />
					</div>

					<div className="flex flex-col gap-2">
						<p className="text-sm font-medium text-muted-foreground">
							Remote workers
						</p>
						{servers && servers.length > 0 ? (
							<div className="flex flex-col gap-3">
								{servers.map((runtimeWorker) => (
									<BuildsConcurrency
										key={runtimeWorker.runtimeWorkerId}
										runtimeWorkerId={runtimeWorker.runtimeWorkerId}
										label={runtimeWorker.name}
									/>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
								No remote workers added yet.
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Page;
