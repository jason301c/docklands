"use client";

import { Loader2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { useLocalStorage } from "@/client/hooks/useLocalStorage";
import { ContainerFreeMonitoring } from "@/components/dashboard/metrics/free/container/show-free-container-monitoring";
import { ShowPaidMonitoring } from "@/components/dashboard/metrics/paid/runtime-workers/show-paid-monitoring";

const BASE_URL = "http://localhost:3001/metrics";

const DEFAULT_TOKEN = "metrics";

const Dashboard = () => {
	const [toggleMonitoring, _setToggleMonitoring] = useLocalStorage(
		"monitoring-enabled",
		false,
	);

	const { data: monitoring, isPending } = api.user.getMetricsToken.useQuery();
	return (
		<div className="space-y-4 pb-10">
			{isPending ? (
				<div className="flex min-h-[50vh] items-center justify-center rounded-lg border bg-kumo-canvas px-4 text-kumo-subtle">
					Loading...
					<Loader2 className="h-4 w-4 animate-spin" />
				</div>
			) : (
				<>
					{/* {monitoring?.enabledFeatures && (
						<div className="flex flex-row border w-fit p-4 rounded-lg items-center gap-2">
							<Label className="text-kumo-subtle">Metrics source</Label>
							<Switch
								checked={toggleMonitoring}
								onCheckedChange={setToggleMonitoring}
							/>
						</div>
					)} */}
					{toggleMonitoring ? (
						<div className="rounded-lg border bg-kumo-canvas">
							<ShowPaidMonitoring
								BASE_URL={
									process.env.NODE_ENV === "production"
										? `http://${monitoring?.serverIp}:${monitoring?.metricsConfig?.runtimeWorker?.port}/metrics`
										: BASE_URL
								}
								token={
									process.env.NODE_ENV === "production"
										? monitoring?.metricsConfig?.runtimeWorker?.token
										: DEFAULT_TOKEN
								}
							/>
						</div>
					) : (
						<div className="rounded-lg border bg-kumo-canvas p-6">
							<ContainerFreeMonitoring appName="docklands" />
						</div>
					)}
				</>
			)}
		</div>
	);
};

export default Dashboard;
