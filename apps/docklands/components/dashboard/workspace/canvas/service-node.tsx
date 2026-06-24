import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { formatDistanceToNow } from "date-fns";
import {
	Cable,
	CircuitBoard,
	Database,
	GlobeIcon,
	Grip,
	HardDrive,
} from "lucide-react";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { cn } from "@/shared/utils";
import type {
	WorkspaceService,
	WorkspaceServiceStatus,
} from "@/shared/workspace-graph";
import { serviceTypeLabels } from "./constants";

const serviceIconClassName = "size-6 text-kumo-subtle";

/** Source-aware service glyph: custom app icon, runtime, or DB engine mark. */
export const WorkspaceServiceIcon = ({
	service,
}: {
	service: WorkspaceService;
}) => {
	if (service.type === "application") {
		if (service.icon) {
			return (
				<img
					src={service.icon}
					alt=""
					className="size-7 object-contain"
					aria-hidden="true"
				/>
			);
		}
		return <GlobeIcon className={serviceIconClassName} />;
	}

	if (service.type === "compose")
		return <CircuitBoard className={serviceIconClassName} />;
	if (service.type === "libsql")
		return <LibsqlIcon className={serviceIconClassName} />;
	if (service.type === "mariadb")
		return <MariadbIcon className={serviceIconClassName} />;
	if (service.type === "mongo")
		return <MongodbIcon className={serviceIconClassName} />;
	if (service.type === "mysql")
		return <MysqlIcon className={serviceIconClassName} />;
	if (service.type === "postgres")
		return <PostgresqlIcon className={serviceIconClassName} />;
	if (service.type === "redis")
		return <RedisIcon className={serviceIconClassName} />;

	return <Database className={serviceIconClassName} />;
};

export type ServiceStatusMeta = {
	label: string;
	dotClass: string;
	pulse?: boolean;
};

// A service's status comes from its deploy-status column (idle/running/done/
// error). "done" means the last deploy landed and the service is up, so it reads
// as "Online"; "running" is a deploy in flight. This is the friendly label shown
// on the canvas card and the panel sub-header.
export const serviceStatusMeta = (
	status: WorkspaceServiceStatus | null | undefined,
): ServiceStatusMeta => {
	switch (status) {
		case "running":
			return { label: "Deploying", dotClass: "bg-kumo-warning", pulse: true };
		case "done":
			return { label: "Online", dotClass: "bg-kumo-success" };
		case "error":
			return { label: "Failed", dotClass: "bg-kumo-danger" };
		default:
			return { label: "Inactive", dotClass: "bg-kumo-subtle/60" };
	}
};

export const formatLastDeployment = (lastDeployAt?: string | null) =>
	lastDeployAt
		? formatDistanceToNow(new Date(lastDeployAt), { addSuffix: true })
		: "No deployments yet";

export type ServiceNodeData = {
	service: WorkspaceService;
	linkCount: number;
	dimmed: boolean;
	selectionMode: boolean;
	isActive: boolean;
	isBulkSelected: boolean;
	isConnectSource: boolean;
	isConnectCandidate: boolean;
};

export type ServiceFlowNode = Node<ServiceNodeData, "service">;

const handleClassName =
	"!size-2.5 !min-w-0 !rounded-full !border !border-kumo-line !bg-kumo-canvas opacity-0 transition group-hover:opacity-100 data-[connectable=true]:opacity-100";

/**
 * The canvas service card, rendered as a React Flow custom node. All per-node
 * state arrives via `data` (React Flow renders nodes outside the canvas JSX
 * tree, so it cannot read component closures); selection / connect / open is
 * wired at the `<ReactFlow>` level via `onNodeClick` and the handles below.
 */
export const ServiceNode = ({ data }: NodeProps<ServiceFlowNode>) => {
	const {
		service,
		linkCount,
		dimmed,
		selectionMode,
		isActive,
		isBulkSelected,
		isConnectSource,
		isConnectCandidate,
	} = data;
	const statusMeta = serviceStatusMeta(service.status);
	const volumes = service.volumes ?? [];

	return (
		<div
			className={cn(
				"group relative h-full w-full transition",
				dimmed && "opacity-30",
			)}
		>
			<Handle
				type="target"
				position={Position.Left}
				className={handleClassName}
			/>
			<LayerCard
				className={cn(
					"relative h-full bg-kumo-canvas/95 shadow-sm transition hover:bg-kumo-canvas",
					(isActive || isBulkSelected || isConnectSource) &&
						"ring-2 ring-kumo-brand",
					isConnectCandidate && "ring-1 ring-kumo-brand/30",
				)}
			>
				<div className="flex h-full flex-col gap-3">
					<div className="flex items-start justify-between gap-3">
						<div className="flex min-w-0 items-start gap-2.5">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/40">
								<WorkspaceServiceIcon service={service} />
							</div>
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<span className="truncate font-medium">{service.name}</span>
									<Grip className="size-3 shrink-0 text-kumo-subtle opacity-0 transition group-hover:opacity-100" />
								</div>
								<p className="truncate text-xs text-kumo-subtle">
									{service.primaryDomain ?? serviceTypeLabels[service.type]}
								</p>
							</div>
						</div>
						{selectionMode && (
							<Badge>{isBulkSelected ? "Selected" : "Select"}</Badge>
						)}
					</div>

					<div className="flex items-center gap-2 text-sm">
						<span
							className={cn(
								"size-2 shrink-0 rounded-full",
								statusMeta.dotClass,
								statusMeta.pulse && "animate-pulse",
							)}
						/>
						<span className="text-kumo-default">{statusMeta.label}</span>
						{(service.replicas ?? 0) > 1 && (
							<span className="text-xs text-kumo-subtle">
								· {service.replicas} replicas
							</span>
						)}
					</div>

					<div className="mt-auto space-y-1.5">
						{volumes.slice(0, 1).map((volume) => (
							<div
								key={volume.name}
								className="flex items-center gap-1.5 rounded-md border bg-kumo-fill/20 px-2 py-1 text-xs text-kumo-subtle"
							>
								<HardDrive className="size-3 shrink-0" />
								<span className="truncate">{volume.name}</span>
								{volumes.length > 1 && (
									<span className="ml-auto shrink-0">
										+{volumes.length - 1}
									</span>
								)}
							</div>
						))}
						<div className="flex items-center justify-between gap-2 text-xs text-kumo-subtle">
							<span className="truncate">
								{service.lastDeployAt
									? `Deployed ${formatLastDeployment(service.lastDeployAt)}`
									: "Not deployed"}
							</span>
							{linkCount > 0 && (
								<span className="flex shrink-0 items-center gap-1">
									<Cable className="size-3" />
									{linkCount}
								</span>
							)}
						</div>
					</div>
				</div>
			</LayerCard>
			<Handle
				type="source"
				position={Position.Right}
				className={handleClassName}
			/>
		</div>
	);
};
