import { Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { ShowContainerConfig } from "@/components/dashboard/docker/config/show-container-config";
import { ShowContainerMounts } from "@/components/dashboard/docker/mounts/show-container-mounts";
import { ShowContainerNetworks } from "@/components/dashboard/docker/networks/show-container-networks";
import { DockerTerminalModal } from "@/components/dashboard/docker/terminal/docker-terminal-modal";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Table } from "@cloudflare/kumo/components/table";

const DockerLogsId = dynamic(
	() =>
		import("@/components/dashboard/docker/logs/docker-logs-id").then(
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

export const ShowComposeContainers = ({
	appName,
	appType,
	serverId,
}: Props) => {
	const { data, isPending, refetch } =
		api.docker.getContainersByAppNameMatch.useQuery(
			{
				appName,
				appType,
				serverId,
			},
			{
				enabled: !!appName,
			},
		);

	return (
		<LayerCard className="bg-background">
			<div className="flex flex-row items-center justify-between">
				<div>
					<h3 className="text-xl">Containers</h3>
					<p>
						Inspect each container in this compose and run basic lifecycle
						actions.
					</p>
				</div>
				<Button aria-label="Action"
					variant="outline"
					shape="square"
					onClick={() => refetch()}
					disabled={isPending}
				>
					<RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
				</Button>
			</div>
			<div>
				{isPending ? (
					<div className="flex items-center justify-center h-[20vh]">
						<Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
					</div>
				) : !data || data.length === 0 ? (
					<div className="flex items-center justify-center h-[20vh]">
						<span className="text-muted-foreground">
							No containers found. Deploy the compose to see containers here.
						</span>
					</div>
				) : (
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
										serverId={serverId}
										onActionComplete={() => refetch()}
									/>
								))}
							</Table.Body>
						</Table>
					</div>
				)}
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
	serverId?: string;
	onActionComplete: () => void;
}

const ContainerRow = ({
	container,
	serverId,
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
				serverId,
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
			<Table.Cell className="font-mono text-sm text-muted-foreground">
				{container.containerId}
			</Table.Cell>
			<Table.Cell className="text-right">
				<Dialog.Root open={logsOpen} onOpenChange={setLogsOpen}>
					<DropdownMenu>
						<DropdownMenu.Trigger render={(

							<Button variant="ghost" className="h-8 w-8 p-0">
								{actionLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<MoreHorizontal className="h-4 w-4" />
								)}
							</Button>
						
)} />
						<DropdownMenu.Content align="end">
							<DropdownMenu.Label>Actions</DropdownMenu.Label>
							<Dialog.Trigger render={(

								<DropdownMenu.Item
									className="cursor-pointer"
									onSelect={(e) => e.preventDefault()}
								>
									View Logs
								</DropdownMenu.Item>
							
)} />
							<ShowContainerConfig
								containerId={container.containerId}
								serverId={serverId || ""}
							/>
							<ShowContainerMounts
								containerId={container.containerId}
								serverId={serverId || ""}
							/>
							<ShowContainerNetworks
								containerId={container.containerId}
								serverId={serverId || ""}
							/>
							<DockerTerminalModal
								containerId={container.containerId}
								serverId={serverId || ""}
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
								className="cursor-pointer text-red-500 focus:text-red-600"
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
								serverId={serverId}
								runType="native"
							/>
						</div>
					</Dialog>
				</Dialog.Root>
			</Table.Cell>
		</Table.Row>
	);
};
