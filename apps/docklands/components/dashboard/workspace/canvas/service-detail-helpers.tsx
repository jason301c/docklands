import { Button } from "@cloudflare/kumo/components/button";
import { SquareTerminal } from "lucide-react";
import { ShowExternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-external-database-credentials";
import { ShowInternalDatabaseCredentials } from "@/components/dashboard/database-service/general/show-internal-database-credentials";
import { ServiceTerminalModal } from "@/components/dashboard/shared/terminal/service-terminal-modal";
import type { WorkspaceService } from "@/shared/workspace-graph";
import { databaseCredentialServiceTypes } from "./service-classification";

export const DatabaseCredentials = ({
	service,
}: {
	service: WorkspaceService;
}) => {
	if (!databaseCredentialServiceTypes.has(service.type)) return null;
	return (
		<div className="space-y-4">
			<ShowInternalDatabaseCredentials databaseId={service.id} />
			<ShowExternalDatabaseCredentials databaseId={service.id} />
		</div>
	);
};

export const ServiceTerminalButton = ({
	service,
	className,
}: {
	service: WorkspaceService;
	className?: string;
}) => {
	if (!service.appName) return null;

	return (
		<ServiceTerminalModal
			appName={service.appName}
			runtimeWorkerId={service.runtimeWorkerId || ""}
			appType={
				service.type === "compose"
					? service.composeType || "docker-compose"
					: undefined
			}
		>
			<Button variant="outline" className={className}>
				<SquareTerminal className="size-4" />
				Open terminal
			</Button>
		</ServiceTerminalModal>
	);
};
