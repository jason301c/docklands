"use client";

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ShowSchedules } from "@/components/dashboard/application/schedules/show-schedules";
import { ServerFilter } from "@/components/shared/server-filter";

function SchedulesPage() {
	return (
		<ServerFilter>
			{(serverId) => (
				<div className="w-full">
					<LayerCard className="h-full bg-sidebar p-2.5 rounded-xl w-full min-h-[45vh]">
						<div className="rounded-xl bg-background shadow-md h-full">
							<ShowSchedules
								scheduleType={serverId ? "server" : "docklands-server"}
								id={serverId ?? "docklands-server"}
							/>
						</div>
					</LayerCard>
				</div>
			)}
		</ServerFilter>
	);
}
export default SchedulesPage;
