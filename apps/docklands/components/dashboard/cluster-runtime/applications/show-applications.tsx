import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Layers, Loader2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { type ApplicationList, columns } from "./columns";
import { DataTable } from "./data-table";

interface Props {
	runtimeWorkerId?: string;
}

export const ShowNodeApplications = ({ runtimeWorkerId }: Props) => {
	const { data: NodeApps, isPending: NodeAppsLoading } =
		api.swarm.getNodeApps.useQuery({ runtimeWorkerId });

	let applicationList: string[] = [];

	if (NodeApps && NodeApps.length > 0) {
		applicationList = NodeApps.map((app) => app.Name);
	}

	const { data: NodeAppDetails, isPending: NodeAppDetailsLoading } =
		api.swarm.getAppInfos.useQuery({
			appName: applicationList,
			runtimeWorkerId,
		});

	if (NodeAppsLoading || NodeAppDetailsLoading) {
		return (
			<Dialog.Root>
				<Dialog.Trigger
					render={
						<Button variant="outline" size="sm" className="w-full">
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						</Button>
					}
				/>
			</Dialog.Root>
		);
	}

	if (!NodeApps || !NodeAppDetails) {
		return (
			<span className="text-sm w-full flex text-center justify-center items-center">
				No data found
			</span>
		);
	}

	const combinedData: ApplicationList[] = NodeApps.flatMap((app) => {
		const appDetails =
			NodeAppDetails?.filter((detail) =>
				detail.Name.startsWith(`${app.Name}.`),
			) || [];

		if (appDetails.length === 0) {
			return [
				{
					...app,
					CurrentState: "N/A",
					DesiredState: "N/A",
					Error: "",
					Node: "N/A",
					Ports: app.Ports,
				},
			];
		}

		return appDetails.map((detail) => ({
			...app,
			CurrentState: detail.CurrentState,
			DesiredState: detail.DesiredState,
			Error: detail.Error,
			Node: detail.Node,
			Ports: detail.Ports || app.Ports,
			runtimeWorkerId: runtimeWorkerId || "",
		}));
	});

	return (
		<Dialog.Root>
			<Dialog.Trigger
				render={
					<Button variant="outline" size="sm" className="w-full">
						<Layers className="h-4 w-4 mr-2" />
						Services
					</Button>
				}
			/>
			<Dialog className={"sm:max-w-10xl"}>
				<div>
					<Dialog.Title>Node Applications</Dialog.Title>
					<Dialog.Description>
						See in detail the applications running on this node
					</Dialog.Description>
				</div>
				<div className="max-h-[80vh]">
					<DataTable columns={columns} data={combinedData ?? []} />
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
