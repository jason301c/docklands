import { Badge } from "@cloudflare/kumo/components/badge";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";

export const DockerLogs = dynamic(
	() =>
		import("@/components/dashboard/docker/logs/docker-logs-id").then(
			(e) => e.DockerLogsId,
		),
	{
		ssr: false,
	},
);

export const badgeStateColor = (state: string) => {
	switch (state) {
		case "running":
		case "ready":
			return "green";
		case "exited":
		case "shutdown":
			return "red";
		case "accepted":
		case "created":
			return "blue";
		default:
			return "secondary";
	}
};

interface Props {
	appName: string;
	serverId?: string;
}

export const ShowDockerLogs = ({ appName, serverId }: Props) => {
	const [containerId, setContainerId] = useState<string | undefined>();
	const [option, setOption] = useState<"swarm" | "native">("native");

	const { data: services, isPending: servicesLoading } =
		api.docker.getServiceContainersByAppName.useQuery(
			{
				appName,
				serverId,
			},
			{
				enabled: !!appName && option === "swarm",
			},
		);

	const { data: containers, isPending: containersLoading } =
		api.docker.getContainersByAppNameMatch.useQuery(
			{
				appName,
				serverId,
			},
			{
				enabled: !!appName && option === "native",
			},
		);

	useEffect(() => {
		if (option === "native") {
			if (containers && containers?.length > 0) {
				setContainerId(containers[0]?.containerId);
			}
		} else {
			if (services && services?.length > 0) {
				setContainerId(services[0]?.containerId);
			}
		}
	}, [option, services, containers]);

	const isLoading = option === "native" ? containersLoading : servicesLoading;
	const containersLength =
		option === "native" ? containers?.length : services?.length;

	return (
		<LayerCard className="bg-background">
			<div>
				<h3 className="text-xl">Logs</h3>
				<p>Watch the logs of the application in real time</p>
			</div>

			<div className="flex flex-col gap-4">
				<div className="flex flex-row justify-between items-center gap-2">
					<Label>Select a container to view logs</Label>
					<div className="flex flex-row gap-2 items-center">
						<span className="text-sm text-muted-foreground">
							{option === "native" ? "Local" : "Orchestrated"}
						</span>
						<Switch
							checked={option === "native"}
							onCheckedChange={(checked) => {
								setOption(checked ? "native" : "swarm");
							}}
						/>
					</div>
				</div>

				<Select
					aria-label="Select option"
					onValueChange={(value) =>
						value !== null && setContainerId(value as never)
					}
					value={containerId}
				>
					<>
						{isLoading ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : null}
					</>
					<>
						<Select.Group>
							{option === "native" ? (
								<div>
									{containers?.map((container) => (
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
								</div>
							) : (
								<>
									{services?.map((container) => (
										<Select.Option
											key={container.containerId}
											value={container.containerId}
										>
											{container.name} ({container.containerId}@{container.node}
											)
											<Badge variant={badgeStateColor(container.state)}>
												{container.state}
											</Badge>
											{container.currentState
												? ` ${container.currentState}`
												: ""}
										</Select.Option>
									))}
								</>
							)}

							<Select.GroupLabel>
								Containers ({containersLength})
							</Select.GroupLabel>
						</Select.Group>
					</>
				</Select>
				{option === "swarm" &&
					services?.find((c) => c.containerId === containerId)?.error && (
						<div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
							<span className="font-medium">Error: </span>
							{services?.find((c) => c.containerId === containerId)?.error}
						</div>
					)}
				<DockerLogs
					serverId={serverId || ""}
					containerId={containerId || "select-a-container"}
					runType={option}
				/>
			</div>
		</LayerCard>
	);
};
