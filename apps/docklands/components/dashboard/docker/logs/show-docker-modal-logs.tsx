import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import dynamic from "next/dynamic";
import type React from "react";

export const DockerLogsId = dynamic(
	() =>
		import("@/components/dashboard/docker/logs/docker-logs-id").then(
			(e) => e.DockerLogsId,
		),
	{
		ssr: false,
	},
);

interface Props {
	containerId: string;
	children?: React.ReactNode;
	serverId?: string | null;
}

export const ShowDockerModalLogs = ({
	containerId,
	children,
	serverId,
}: Props) => {
	return (
		<Dialog.Root>
			<Dialog.Trigger
				render={
					<DropdownMenu.Item
						className="w-full cursor-pointer space-x-3"
						onSelect={(e) => e.preventDefault()}
					>
						{children}
					</DropdownMenu.Item>
				}
			/>
			<Dialog className="sm:max-w-7xl">
				<div>
					<Dialog.Title>View Logs</Dialog.Title>
					<Dialog.Description>
						View the logs for {containerId}
					</Dialog.Description>
				</div>
				<div className="flex flex-col gap-4 pt-2.5">
					<DockerLogsId
						containerId={containerId || ""}
						serverId={serverId}
						runType="native"
					/>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
