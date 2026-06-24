import { ContainerMonitoring } from "@/components/dashboard/metrics/container/show-container-monitoring";
import { requirePermission, requireSelfHosted } from "@/server/web/app-auth";

export default async function Page() {
	requireSelfHosted();
	await requirePermission("monitoring", "read", "/dashboard/workspace");
	return (
		<div className="space-y-4 pb-10">
			<div className="rounded-lg border bg-kumo-canvas p-6">
				<ContainerMonitoring appName="docklands" />
			</div>
		</div>
	);
}
