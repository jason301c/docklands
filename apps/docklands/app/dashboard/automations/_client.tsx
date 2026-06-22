"use client";

import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

function SchedulesPage() {
	return (
		<RuntimeWorkerFilter>
			{(runtimeWorkerId) => (
				<div className="w-full">
					<div className="min-h-[45vh] rounded-lg border bg-background">
						<ShowSchedules
							scheduleType={
								runtimeWorkerId ? "runtimeWorker" : "docklands-server"
							}
							id={runtimeWorkerId ?? "docklands-server"}
						/>
					</div>
				</div>
			)}
		</RuntimeWorkerFilter>
	);
}
export default SchedulesPage;
