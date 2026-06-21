import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { badgeStateColor } from "@/components/dashboard/application/logs/show";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { ContainerFreeMonitoring } from "./show-free-container-monitoring";

interface Props {
	appName: string;
	serverId?: string;
	appType: "stack" | "docker-compose";
}

export const ComposeFreeMonitoring = ({
	appName,
	appType = "stack",
	serverId,
}: Props) => {
	const { data, isPending } = api.docker.getContainersByAppNameMatch.useQuery(
		{
			appName: appName,
			appType,
			serverId,
		},
		{
			enabled: !!appName,
		},
	);

	const [containerAppName, setContainerAppName] = useState<
		string | undefined
	>();

	const [containerId, setContainerId] = useState<string | undefined>();

	const { mutateAsync: restart, isPending: isRestarting } =
		api.docker.restartContainer.useMutation();

	useEffect(() => {
		if (data && data?.length > 0) {
			setContainerAppName(data[0]?.name);
			setContainerId(data[0]?.containerId);
		}
	}, [data]);

	return (
		<>
			<div>
				<h3 className="text-xl">Monitoring</h3>
				<p>Watch the usage of your compose</p>
			</div>
			<div className="flex flex-col gap-4">
				<Label>Select a container to watch the monitoring</Label>
				<div className="flex flex-row gap-4">
					<Select aria-label="Select option"
						onValueChange={(value) => {
							if (value === null) return;
							setContainerAppName(value);
							setContainerId(
								data?.find((container) => container.name === value)
									?.containerId,
							);
						}}
						value={containerAppName}
					>
						<>
							{isPending ? (
								<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground">
									<span>Loading...</span>
									<Loader2 className="animate-spin size-4" />
								</div>
							) : null}
						</>
						<>
							<Select.Group>
								{data?.map((container) => (
									<Select.Option
										key={container.containerId}
										value={container.name}
									>
										{container.name} ({container.containerId}){" "}
										<Badge variant={badgeStateColor(container.state)}>
											{container.state}
										</Badge>
									</Select.Option>
								))}
								<Select.GroupLabel>Containers ({data?.length})</Select.GroupLabel>
							</Select.Group>
						</>
					</Select>
					<Button
						loading={isRestarting}
						onClick={async () => {
							if (!containerId) return;
							toast.success(`Restarting container ${containerAppName}`);
							await restart({ containerId }).then(() => {
								toast.success("Container restarted");
							});
						}}
					>
						Restart
					</Button>
				</div>
				<ContainerFreeMonitoring
					appName={containerAppName || ""}
					appType={appType}
				/>
			</div>
		</>
	);
};
