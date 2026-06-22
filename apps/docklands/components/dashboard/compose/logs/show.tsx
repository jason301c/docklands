import { Badge } from "@cloudflare/kumo/components/badge";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { badgeStateColor } from "@/components/dashboard/application/logs/show";

export const DockerLogs = dynamic(
	() =>
		import("@/components/dashboard/container-runtime/logs/docker-logs-id").then(
			(e) => e.DockerLogsId,
		),
	{
		ssr: false,
	},
);

interface Props {
	appName: string;
	serverId?: string;
	appType: "stack" | "docker-compose";
}

export const ShowDockerLogsCompose = ({
	appName,
	appType,
	serverId,
}: Props) => {
	const { data, isPending } = api.docker.getContainersByAppNameMatch.useQuery(
		{
			appName,
			appType,
			serverId,
		},
		{
			enabled: !!appName,
		},
	);
	const [containerId, setContainerId] = useState<string | undefined>();

	useEffect(() => {
		if (data && data?.length > 0) {
			setContainerId(data[0]?.containerId);
		}
	}, [data]);

	return (
		<LayerCard className="bg-background">
			<div>
				<h3 className="text-xl">Logs</h3>
				<p>Watch the logs of the application in real time</p>
			</div>

			<div className="flex flex-col gap-4">
				<Label>Select a container to view logs</Label>
				<Select
					aria-label="Compose log container"
					onValueChange={(value) =>
						value !== null && setContainerId(value as never)
					}
					value={containerId}
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
									value={container.containerId}
								>
									{container.name} ({container.containerId}){" "}
									<Badge variant={badgeStateColor(container.state)}>
										{container.state}
									</Badge>
									{container.status ? ` ${container.status}` : ""}
								</Select.Option>
							))}
							<Select.GroupLabel>Containers ({data?.length})</Select.GroupLabel>
						</Select.Group>
					</>
				</Select>
				<DockerLogs
					serverId={serverId || ""}
					containerId={containerId || "select-a-container"}
					runType="native"
				/>
			</div>
		</LayerCard>
	);
};
