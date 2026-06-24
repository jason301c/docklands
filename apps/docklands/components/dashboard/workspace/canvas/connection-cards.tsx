import { Badge } from "@cloudflare/kumo/components/badge";
import { ArrowRight, Network } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/client/api/trpc";
import type {
	WorkspaceService,
	WorkspaceServiceType,
} from "@/shared/workspace-graph";
import { serviceTypeLabels } from "./constants";
import { WorkspaceServiceIcon } from "./service-node";
import type { WorkspaceConnection } from "./types";

const ConnectionVariablePreview = ({
	connectionId,
	enabled,
}: {
	connectionId: string;
	enabled: boolean;
}) => {
	const variablesQuery = api.workspaceGraph.connectionVariables.useQuery(
		{ connectionId },
		{ enabled },
	);

	if (!enabled) return null;

	if (variablesQuery.isPending) {
		return <p className="text-xs text-kumo-subtle">Loading variable keys...</p>;
	}

	if (!variablesQuery.data?.length) {
		return (
			<p className="text-xs text-kumo-subtle">
				No generated variables for this source.
			</p>
		);
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			{variablesQuery.data.map((variable) => (
				<Badge key={variable.key}>{variable.key}</Badge>
			))}
		</div>
	);
};

const WorkspaceServiceFlowNode = ({
	service,
	serviceType,
	fallbackLabel,
}: {
	service?: WorkspaceService;
	serviceType: WorkspaceServiceType;
	fallbackLabel: string;
}) => (
	<div className="min-w-0 rounded-md border bg-kumo-canvas px-3 py-2">
		<div className="flex min-w-0 items-center gap-2">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/30">
				{service ? (
					<WorkspaceServiceIcon service={service} />
				) : (
					<Network className="size-4 text-kumo-subtle" />
				)}
			</div>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">
					{service?.name ?? fallbackLabel}
				</p>
				<p className="truncate text-xs text-kumo-subtle">
					{serviceTypeLabels[service?.type ?? serviceType] ?? serviceType}
				</p>
			</div>
		</div>
	</div>
);

export const ConnectionVariableFlowCard = ({
	connection,
	source,
	target,
	variablePreviewEnabled,
	actions,
}: {
	connection: WorkspaceConnection;
	source?: WorkspaceService;
	target?: WorkspaceService;
	variablePreviewEnabled: boolean;
	actions?: ReactNode;
}) => (
	<div className="space-y-3 rounded-md border bg-kumo-canvas/80 p-3">
		<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
			<WorkspaceServiceFlowNode
				service={source}
				serviceType={connection.sourceServiceType}
				fallbackLabel="Unknown source"
			/>
			<div className="flex size-8 items-center justify-center rounded-full border bg-kumo-fill/30">
				<ArrowRight className="size-4 text-kumo-subtle" />
			</div>
			<WorkspaceServiceFlowNode
				service={target}
				serviceType={connection.targetServiceType}
				fallbackLabel="Unknown target"
			/>
		</div>

		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0 flex-1 space-y-2">
				<div className="flex flex-wrap items-center gap-1.5">
					<Badge>{connection.label || "Private network"}</Badge>
					<Badge>Generated variables</Badge>
				</div>
				<ConnectionVariablePreview
					connectionId={connection.connectionId}
					enabled={variablePreviewEnabled}
				/>
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-1">{actions}</div>
			) : null}
		</div>
	</div>
);
