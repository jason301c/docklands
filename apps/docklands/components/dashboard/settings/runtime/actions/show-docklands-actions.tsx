import { Button } from "@cloudflare/kumo/components/button";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { UpdatePublicIp } from "@/components/dashboard/settings/ingress-runtime/update-public-ip";
import { RuntimeTerminalModal } from "@/components/dashboard/settings/runtime/terminal/runtime-terminal-modal";
import { ServiceLogsModal } from "@/components/dashboard/shared/service-logs-modal";
import { DropdownMenu } from "@/components/shared/dropdown";
import { toast } from "@/components/shared/toast";
import { GPUSupportModal } from "../gpu-support-modal";

const logger = createClientLogger("runtime-actions");

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
								.catch((err) => {
									logger.error("runtime reload failed", err);
									toast.error("Failed to reload runtime. Check server logs.");
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
								.catch((err) => {
									logger.error("deployment queue clean failed", err);
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
