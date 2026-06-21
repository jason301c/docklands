"use client";

import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { ServerFilter } from "@/components/shared/server-filter";
import { Card } from "@/components/ui/card";

function SchedulesPage() {
	return (
		<ServerFilter>
			{(serverId) => (
				<div className="w-full">
					<Card className="h-full bg-sidebar p-2.5 rounded-xl w-full min-h-[45vh]">
						<div className="rounded-xl bg-background shadow-md h-full">
							<ShowSchedules
								scheduleType={serverId ? "server" : "docklands-server"}
								id={serverId ?? "docklands-server"}
							/>
						</div>
					</Card>
				</div>
			)}
		</ServerFilter>
	);
}
export default SchedulesPage;
