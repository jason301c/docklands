import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { api } from "@/client/api/trpc";
import { ServiceLogsModal } from "@/components/dashboard/container-runtime/logs/service-logs-modal";
import { UpdatePublicIp } from "@/components/dashboard/settings/ingress-runtime/update-public-ip";
import { RuntimeTerminalModal } from "@/components/dashboard/settings/runtime/terminal/runtime-terminal-modal";
import { toast } from "@/components/shared/toast";
import { GPUSupportModal } from "../gpu-support-modal";

export const ShowDocklandsActions = () => {
	const { mutateAsync: reloadServer, isPending } =
		api.settings.reloadServer.useMutation();

	const { mutateAsync: cleanAllDeploymentQueue } =
		api.settings.cleanAllDeploymentQueue.useMutation();

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				disabled={isPending}
				render={
					<Button loading={isPending} variant="outline">
						Runtime
					</Button>
				}
			/>
			<DropdownMenu.Content className="w-56" align="start">
				<DropdownMenu.Group>
					<DropdownMenu.Label>Actions</DropdownMenu.Label>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item
						onClick={async () => {
							await reloadServer()
								.then(async () => {
									toast.success("Runtime reloaded");
								})
								.catch(() => {
									toast.success("Runtime reloaded");
								});
						}}
						className="cursor-pointer"
					>
						<span>Reload</span>
					</DropdownMenu.Item>
					<RuntimeTerminalModal runtimeWorkerId="local">
						<span>Terminal</span>
					</RuntimeTerminalModal>
					<ServiceLogsModal appName="docklands">
						<DropdownMenu.Item
							className="cursor-pointer"
							onSelect={(e) => e.preventDefault()}
						>
							View Logs
						</DropdownMenu.Item>
					</ServiceLogsModal>
					<GPUSupportModal />
					<UpdatePublicIp>
						<DropdownMenu.Item
							className="cursor-pointer"
							onSelect={(e) => e.preventDefault()}
						>
							Update public IP
						</DropdownMenu.Item>
					</UpdatePublicIp>

					<DropdownMenu.Item
						className="cursor-pointer"
						onClick={async () => {
							await cleanAllDeploymentQueue()
								.then(() => {
									toast.success("Deployment queue cleaned");
								})
								.catch(() => {
									toast.error("Error cleaning deployment queue");
								});
						}}
					>
						Clean deployment queue
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
