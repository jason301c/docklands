import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { ShowContainerConfig } from "@/components/dashboard/container-runtime/config/show-container-config";
import { ShowContainerMounts } from "@/components/dashboard/container-runtime/mounts/show-container-mounts";
import { ShowContainerNetworks } from "@/components/dashboard/container-runtime/networks/show-container-networks";
import { DockerTerminalModal } from "@/components/dashboard/container-runtime/terminal/docker-terminal-modal";
import { Dialog } from "@/components/shared/dialog";
import { DropdownMenu } from "@/components/shared/dropdown";
import { QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";

const DockerLogsId = dynamic(
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
	runtimeWorkerId?: string;
	appType: "stack" | "docker-compose";
}

export const ShowComposeContainers = ({
	appName,
	appType,
	runtimeWorkerId,
}: Props) => {
	const containersQuery = api.docker.getContainersByAppNameMatch.useQuery(
		{
			appName,
			appType,
			runtimeWorkerId,
		},
		{
			enabled: !!appName,
		},
	);
	const { isPending, refetch } = containersQuery;

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row items-center justify-between">
				<div>
					<h3 className="text-xl font-semibold">Containers</h3>
					<p>
						Inspect each container in this compose and run basic lifecycle
						actions.
					</p>
				</div>
				<Button
					aria-label="Refresh containers"
					variant="outline"
					shape="square"
					onClick={() => refetch()}
					disabled={isPending}
				>
					<RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
				</Button>
			</div>
			<div>
				<QueryState
					query={containersQuery}
					isEmpty={(data) => data.length === 0}
					empty={
						<div className="flex items-center justify-center h-[20vh]">
							<span className="text-kumo-subtle">
								No containers found. Run a build to see containers here.
							</span>
						</div>
					}
					errorTitle="Failed to load containers"
				>
					{(data) => (
						<div className="rounded-md border">
							<Table>
								<Table.Header>
									<Table.Row>
										<Table.Head>Name</Table.Head>
										<Table.Head>State</Table.Head>
										<Table.Head>Status</Table.Head>
										<Table.Head>Container ID</Table.Head>
										<Table.Head className="text-right" />
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{data.map((container) => (
										<ContainerRow
											key={container.containerId}
											container={container}
											runtimeWorkerId={runtimeWorkerId}
											onActionComplete={() => refetch()}
										/>
									))}
								</Table.Body>
							</Table>
						</div>
					)}
				</QueryState>
			</div>
		</LayerCard>
	);
};

interface ContainerRowProps {
	container: {
		containerId: string;
		name: string;
		state: string;
		status: string;
	};
	runtimeWorkerId?: string;
	onActionComplete: () => void;
}

const ContainerRow = ({
	container,
	runtimeWorkerId,
	onActionComplete,
}: ContainerRowProps) => {
	const [logsOpen, setLogsOpen] = useState(false);
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const restartMutation = api.docker.restartContainer.useMutation();
	const startMutation = api.docker.startContainer.useMutation();
	const stopMutation = api.docker.stopContainer.useMutation();
	const killMutation = api.docker.killContainer.useMutation();

	const handleAction = async (
		action: string,
		mutationFn: typeof restartMutation,
	) => {
		setActionLoading(action);
		try {
			await mutationFn.mutateAsync({
				containerId: container.containerId,
				runtimeWorkerId,
			});
			toast.success(`Container ${action} successfully`);
			onActionComplete();
		} catch (error) {
			toast.error(
				`Failed to ${action} container: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			setActionLoading(null);
		}
	};

	return (
		<Table.Row>
			<Table.Cell className="font-medium">{container.name}</Table.Cell>
			<Table.Cell>
				<Badge
					variant={
						container.state === "running"
							? "secondary"
							: container.state === "exited"
								? "secondary"
								: "destructive"
					}
				>
					{container.state}
				</Badge>
			</Table.Cell>
			<Table.Cell>{container.status}</Table.Cell>
			<Table.Cell className="font-mono text-sm text-kumo-subtle">
				{container.containerId}
			</Table.Cell>
			<Table.Cell className="text-right">
				<Dialog.Root open={logsOpen} onOpenChange={setLogsOpen}>
					<DropdownMenu>
						<DropdownMenu.Trigger
							render={
								<Button
									aria-label={`Open actions for ${container.name}`}
									variant="ghost"
									className="h-8 w-8 p-0"
								>
									{actionLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<MoreHorizontal className="h-4 w-4" />
									)}
								</Button>
							}
						/>
						<DropdownMenu.Content align="end">
							<DropdownMenu.Group>
								<DropdownMenu.Label>Actions</DropdownMenu.Label>
							</DropdownMenu.Group>
							<Dialog.Trigger
								nativeButton={false}
								render={
									<DropdownMenu.Item
										className="cursor-pointer"
										onSelect={(e) => e.preventDefault()}
									>
										View Logs
									</DropdownMenu.Item>
								}
							/>
							<ShowContainerConfig
								containerId={container.containerId}
								runtimeWorkerId={runtimeWorkerId || ""}
							/>
							<ShowContainerMounts
								containerId={container.containerId}
								runtimeWorkerId={runtimeWorkerId || ""}
							/>
							<ShowContainerNetworks
								containerId={container.containerId}
								runtimeWorkerId={runtimeWorkerId || ""}
							/>
							<DockerTerminalModal
								containerId={container.containerId}
								runtimeWorkerId={runtimeWorkerId || ""}
							>
								Terminal
							</DockerTerminalModal>
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								className="cursor-pointer"
								disabled={actionLoading !== null}
								onClick={() => handleAction("restart", restartMutation)}
							>
								Restart
							</DropdownMenu.Item>
							<DropdownMenu.Item
								className="cursor-pointer"
								disabled={actionLoading !== null}
								onClick={() => handleAction("start", startMutation)}
							>
								Start
							</DropdownMenu.Item>
							<DropdownMenu.Item
								className="cursor-pointer"
								disabled={actionLoading !== null}
								onClick={() => handleAction("stop", stopMutation)}
							>
								Stop
							</DropdownMenu.Item>
							<DropdownMenu.Item
								className="cursor-pointer text-kumo-danger focus:text-kumo-danger"
								disabled={actionLoading !== null}
								onClick={() => handleAction("kill", killMutation)}
							>
								Kill
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu>
					<Dialog className="sm:max-w-7xl">
						<div>
							<Dialog.Title>View Logs</Dialog.Title>
							<Dialog.Description>Logs for {container.name}</Dialog.Description>
						</div>
						<div className="flex flex-col gap-4 pt-2.5">
							<DockerLogsId
								containerId={container.containerId}
								runtimeWorkerId={runtimeWorkerId}
								runType="native"
							/>
						</div>
					</Dialog>
				</Dialog.Root>
			</Table.Cell>
		</Table.Row>
	);
};
