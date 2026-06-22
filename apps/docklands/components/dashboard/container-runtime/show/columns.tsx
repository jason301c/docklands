import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { ShowContainerConfig } from "../config/show-container-config";
import { ShowDockerModalLogs } from "../logs/show-docker-modal-logs";
import { ShowContainerMounts } from "../mounts/show-container-mounts";
import { ShowContainerNetworks } from "../networks/show-container-networks";
import { RemoveContainerDialog } from "../remove/remove-container";
import { DockerTerminalModal } from "../terminal/docker-terminal-modal";
import { UploadFileModal } from "../upload/upload-file-modal";
import type { Container } from "./show-containers";

export const columns: ColumnDef<Container>[] = [
	{
		accessorKey: "name",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Name
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			return <div>{row.getValue("name")}</div>;
		},
	},
	{
		accessorKey: "state",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					State
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const value = row.getValue("state") as string;
			return (
				<div className="capitalize">
					<Badge
						variant={
							value === "running"
								? "secondary"
								: value === "failed"
									? "destructive"
									: "secondary"
						}
					>
						{value}
					</Badge>
				</div>
			);
		},
	},
	{
		accessorKey: "status",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Status
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			return <div className="capitalize">{row.getValue("status")}</div>;
		},
	},
	{
		accessorKey: "image",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Image
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => <div className="lowercase">{row.getValue("image")}</div>,
	},
	{
		id: "actions",
		enableHiding: false,
		cell: ({ row }) => {
			const container = row.original;

			return (
				<DropdownMenu>
					<DropdownMenu.Trigger
						render={
							<Button
								aria-label={`Open actions for ${container.name}`}
								variant="ghost"
								className="h-8 w-8 p-0"
							>
								<span className="sr-only">
									Open actions for {container.name}
								</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						}
					/>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Label>Actions</DropdownMenu.Label>
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
		},
	},
];
