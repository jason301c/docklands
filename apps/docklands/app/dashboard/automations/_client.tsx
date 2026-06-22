"use client";

import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { RuntimeWorkerFilter } from "@/components/shared/runtime-worker-filter";

function SchedulesPage() {
	return (
		<RuntimeWorkerFilter>
			{(serverId) => (
				<div className="w-full">
					<div className="min-h-[45vh] rounded-lg border bg-background">
						<ShowSchedules
							scheduleType={serverId ? "server" : "docklands-server"}
							id={serverId ?? "docklands-server"}
						/>
					</div>
				</div>
			)}
		</RuntimeWorkerFilter>
	);
}
export default SchedulesPage;
