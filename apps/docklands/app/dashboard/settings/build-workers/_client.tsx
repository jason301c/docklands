"use client";

import { api } from "@/client/api/trpc";
import { BuildsConcurrency } from "@/components/dashboard/settings/runtime/actions/builds-concurrency";
import { AlertBlock } from "@/components/shared/alert-block";
import { PageHeader } from "@/components/shared/page-header";
import { PageSection } from "@/components/shared/page-section";

const Page = () => {
	const { data: servers } = api.runtimeWorker.all.useQuery();

	return (
		<div className="w-full">
			<PageSection className="h-full gap-4">
				<PageHeader title="Concurrent Builds" />
				<div className="flex flex-col gap-6">
					<AlertBlock type="warning">
						Running multiple builds at once increases CPU, memory and disk usage
						on each runtime. Each concurrent build runs its own builder and
						image build, so set this based on the resources the runtime can
						handle. Too high a value can exhaust memory and make builds fail.
					</AlertBlock>
					<div className="flex flex-col gap-2">
						<p className="text-sm font-medium text-kumo-subtle">
							Local runtime worker
						</p>
						<BuildsConcurrency />
					</div>

					<div className="flex flex-col gap-2">
						<p className="text-sm font-medium text-kumo-subtle">
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
							<p className="text-sm text-kumo-subtle rounded-lg border border-dashed p-4 text-center">
								No remote workers added yet.
							</p>
						)}
					</div>
				</div>
			</PageSection>
		</div>
	);
};

export default Page;
