import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
import { Boxes, MoreHorizontal } from "lucide-react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { ShowContainerConfig } from "@/components/dashboard/shared/container/show-container-config";
import { ShowContainerMounts } from "@/components/dashboard/shared/container/show-container-mounts";
import { ShowContainerNetworks } from "@/components/dashboard/shared/container/show-container-networks";
import { DockerTerminalModal } from "@/components/dashboard/shared/terminal/docker-terminal-modal";
import { DropdownMenu } from "@/components/shared/dropdown";
import {
	EmptyState,
	ErrorState,
	LoadingState,
} from "@/components/shared/states";
import { ShowDockerModalLogs } from "../logs/show-docker-modal-logs";
import { RemoveContainerDialog } from "../remove/remove-container";
import { UploadFileModal } from "../upload/upload-file-modal";

export type Container = NonNullable<
	RouterOutputs["docker"]["getContainers"]
>[0];

interface Props {
	runtimeWorkerId?: string;
}

export const ShowContainers = ({ runtimeWorkerId }: Props) => {
	const containersQuery = api.docker.getContainers.useQuery({
		runtimeWorkerId,
	});

	const containers = containersQuery.data ?? [];

	if (containersQuery.isError) {
		return (
			<ErrorState
				error={containersQuery.error}
				title="Could not load containers"
				onRetry={() => containersQuery.refetch()}
			/>
		);
	}

	if (containersQuery.isPending) {
		return <LoadingState label="Loading containers..." />;
	}

	return (
		<>
			{containers.length === 0 ? (
				<EmptyState
					icon={Boxes}
					title="No runtime containers"
					description="Containers will appear here once services are deployed."
				/>
			) : (
				<div className="flex min-h-[25vh] flex-col gap-4">
					<Table>
						<Table.Header>
							<Table.Row>
								<Table.Head className="min-w-[16rem]">Name</Table.Head>
								<Table.Head>State</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head>Image</Table.Head>
								<Table.Head>Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{containers.map((container) => (
								<Table.Row key={container.containerId}>
									<Table.Cell className="min-w-[16rem] break-all">
										{container.name}
									</Table.Cell>
									<Table.Cell>
										<Badge
											variant={
												container.state === "failed"
													? "destructive"
													: "secondary"
											}
											className="capitalize"
										>
											{container.state}
										</Badge>
									</Table.Cell>
									<Table.Cell className="capitalize">
										{container.status}
									</Table.Cell>
									<Table.Cell className="lowercase break-all">
										{container.image}
									</Table.Cell>
									<Table.Cell>
										<ContainerActions container={container} />
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</div>
			)}
		</>
	);
};

const ContainerActions = ({ container }: { container: Container }) => {
	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button
						aria-label={`Open actions for ${container.name}`}
						variant="ghost"
						className="inline-flex h-8 w-8 items-center justify-center p-0"
					>
						<span className="sr-only">Open actions for {container.name}</span>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				}
			/>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Group>
					<DropdownMenu.Label>Actions</DropdownMenu.Label>
				</DropdownMenu.Group>
				<ShowDockerModalLogs
					containerId={container.containerId}
					runtimeWorkerId={container.runtimeWorkerId}
				>
					View Logs
				</ShowDockerModalLogs>
				<ShowContainerConfig
					containerId={container.containerId}
					runtimeWorkerId={container.runtimeWorkerId || ""}
				/>
				<ShowContainerMounts
					containerId={container.containerId}
					runtimeWorkerId={container.runtimeWorkerId || ""}
				/>
				<ShowContainerNetworks
					containerId={container.containerId}
					runtimeWorkerId={container.runtimeWorkerId || ""}
				/>
				<DockerTerminalModal
					containerId={container.containerId}
					runtimeWorkerId={container.runtimeWorkerId || ""}
				>
					Terminal
				</DockerTerminalModal>
				<UploadFileModal
					containerId={container.containerId}
					runtimeWorkerId={container.runtimeWorkerId || undefined}
				>
					Upload File
				</UploadFileModal>
				<RemoveContainerDialog
					containerId={container.containerId}
					runtimeWorkerId={container.runtimeWorkerId ?? undefined}
				/>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
