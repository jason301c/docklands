"use client";

import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { ServerFilter } from "@/components/shared/server-filter";

function SchedulesPage() {
	return (
		<ServerFilter>
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
		</ServerFilter>
	);
}
export default SchedulesPage;
