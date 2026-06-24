import { Badge } from "@cloudflare/kumo/components/badge";
import { Label } from "@cloudflare/kumo/components/label";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { badgeStateColor } from "@/components/shared/badge-state-color";
import { Dialog } from "@/components/shared/dialog";
import { Select } from "@/components/shared/select";

export const DockerLogsId = dynamic(
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
	children?: React.ReactNode;
	runtimeWorkerId?: string;
	type?: "standalone" | "swarm";
}

export const ServiceLogsModal = ({
	appName,
	children,
	runtimeWorkerId,
	type = "swarm",
}: Props) => {
	const { data, isPending } = api.docker.getContainersByAppLabel.useQuery(
		{
			appName,
			runtimeWorkerId,
			type,
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
		<Dialog.Root>
			<Dialog.Trigger render={children as never} />
			<Dialog className="max-h-[85vh]  sm:max-w-7xl">
				<div>
					<Dialog.Title>View Logs</Dialog.Title>
					<Dialog.Description>View the logs for {appName}</Dialog.Description>
				</div>
				<div className="flex flex-col gap-4 pt-2.5">
					<Label>Select a container to view logs</Label>
					<Select
						aria-label="Service log container"
						onValueChange={(value) =>
							value !== null && setContainerId(value as never)
						}
						value={containerId}
					>
						<>
							{isPending ? (
								<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle">
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
									</Select.Option>
								))}
								<Select.GroupLabel>
									Containers ({data?.length})
								</Select.GroupLabel>
							</Select.Group>
						</>
					</Select>
					<DockerLogsId
						containerId={containerId || ""}
						runtimeWorkerId={runtimeWorkerId}
						runType="native"
					/>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
