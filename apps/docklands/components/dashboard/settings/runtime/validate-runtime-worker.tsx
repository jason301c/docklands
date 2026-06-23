import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Loader2, PcCase, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { StatusRow } from "./gpu-support";

interface Props {
	runtimeWorkerId: string;
}

export const ValidateRuntimeWorker = ({ runtimeWorkerId }: Props) => {
	const [isRefreshing, setIsRefreshing] = useState(false);
	const { data, refetch, error, isPending, isError } =
		api.runtimeWorker.validate.useQuery(
			{ runtimeWorkerId },
			{
				enabled: !!runtimeWorkerId,
			},
		);
	const { data: runtimeWorker } = api.runtimeWorker.one.useQuery(
		{ runtimeWorkerId },
		{
			enabled: !!runtimeWorkerId,
		},
	);
	const isBuildRuntimeWorker = runtimeWorker?.runtimeWorkerType === "build";
	const _utils = api.useUtils();
	return (
		<div className="p-0">
			<div className="flex flex-col gap-4">
				<LayerCard className="bg-kumo-canvas">
					<div className="flex flex-row items-center justify-between flex-wrap gap-2">
						<div className="flex flex-row gap-2 justify-between w-full  max-sm:flex-col">
							<div className="flex flex-col gap-1">
								<div className="flex items-center gap-2">
									<PcCase className="size-5" />
									<h3 className="text-xl font-semibold">Setup Validation</h3>
								</div>
								<p>Check if your worker is ready for builds and runtime</p>
							</div>
							<Button
								loading={isRefreshing}
								onClick={async () => {
									setIsRefreshing(true);
									await refetch();
									setIsRefreshing(false);
								}}
							>
								<RefreshCw className="size-4" />
								Refresh
							</Button>
						</div>
						<div className="flex items-center gap-2 w-full">
							{isError && (
								<AlertBlock type="error" className="w-full">
									{error.message}
								</AlertBlock>
							)}
						</div>
					</div>

					<div className="flex flex-col gap-4">
						{isPending ? (
							<div className="flex items-center justify-center text-kumo-subtle py-4">
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								<span>Checking worker configuration</span>
							</div>
						) : (
							<div className="grid w-full gap-4">
								<div className="border rounded-lg p-4">
									<h3 className="text-lg font-semibold mb-1">Status</h3>
									<p className="text-sm text-kumo-subtle mb-4">
										{isBuildRuntimeWorker
											? "Shows the build worker configuration status"
											: "Shows the runtime worker configuration status"}
									</p>
									<div className="grid gap-2.5">
										<StatusRow
											label="Docker Installed"
											isEnabled={data?.docker?.enabled}
											description={
												data?.docker?.enabled
													? `Installed: ${data?.docker?.version}`
													: undefined
											}
										/>
										{!isBuildRuntimeWorker && (
											<StatusRow
												label="RClone Installed"
												isEnabled={data?.rclone?.enabled}
												description={
													data?.rclone?.enabled
														? `Installed: ${data?.rclone?.version}`
														: undefined
												}
											/>
										)}
										<StatusRow
											label="Nixpacks Installed"
											isEnabled={data?.nixpacks?.enabled}
											description={
												data?.nixpacks?.enabled
													? `Installed: ${data?.nixpacks?.version}`
													: undefined
											}
										/>
										<StatusRow
											label="Buildpacks Installed"
											isEnabled={data?.buildpacks?.enabled}
											description={
												data?.buildpacks?.enabled
													? `Installed: ${data?.buildpacks?.version}`
													: undefined
											}
										/>
										<StatusRow
											label="Railpack Installed"
											isEnabled={data?.railpack?.enabled}
											description={
												data?.railpack?.enabled
													? `Installed: ${data?.railpack?.version}`
													: undefined
											}
										/>
										{!isBuildRuntimeWorker && (
											<>
												<StatusRow
													label="Orchestration Initialized"
													isEnabled={data?.isSwarmInstalled}
													description={
														data?.isSwarmInstalled
															? "Initialized"
															: "Not Initialized"
													}
												/>
												<StatusRow
													label="Docklands Network Created"
													isEnabled={data?.isDocklandsNetworkInstalled}
													description={
														data?.isDocklandsNetworkInstalled
															? "Created"
															: "Not Created"
													}
												/>
											</>
										)}
										<StatusRow
											label="Main Directory Created"
											isEnabled={data?.isMainDirectoryInstalled}
											description={
												data?.isMainDirectoryInstalled
													? "Created"
													: "Not Created"
											}
										/>
										<StatusRow
											label="Privilege Mode"
											isEnabled={
												data?.privilegeMode === "root" ||
												data?.privilegeMode === "sudo"
											}
											description={
												data?.privilegeMode === "root"
													? "Running as root"
													: data?.privilegeMode === "sudo"
														? "Running with sudo"
														: "No sudo access (required for non-root)"
											}
										/>
										<StatusRow
											label="Docker Group"
											isEnabled={data?.dockerGroupMember}
											description={
												data?.dockerGroupMember
													? "User is in docker group"
													: "User is not in docker group"
											}
										/>
									</div>
								</div>
							</div>
						)}
					</div>
				</LayerCard>
			</div>
		</div>
	);
};
