import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { UpdateServerIp } from "@/components/dashboard/settings/web-server/update-server-ip";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { ShowModalLogs } from "../../web-server/show-modal-logs";
import { TerminalModal } from "../../web-server/terminal-modal";
import { GPUSupportModal } from "../gpu-support-modal";

export const ShowDocklandsActions = () => {
	const { mutateAsync: reloadServer, isPending } =
		api.settings.reloadServer.useMutation();

	const { mutateAsync: cleanRedis } = api.settings.cleanRedis.useMutation();
	const { mutateAsync: reloadRedis } = api.settings.reloadRedis.useMutation();
	const { mutateAsync: cleanAllDeploymentQueue } =
		api.settings.cleanAllDeploymentQueue.useMutation();

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger disabled={isPending} render={(

				<Button loading={isPending} variant="outline">
					Server
				</Button>
			
)} />
			<DropdownMenu.Content className="w-56" align="start">
				<DropdownMenu.Label>Actions</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item
						onClick={async () => {
							await reloadServer()
								.then(async () => {
									toast.success("Server Reloaded");
								})
								.catch(() => {
									toast.success("Server Reloaded");
								});
						}}
						className="cursor-pointer"
					>
						<span>Reload</span>
					</DropdownMenu.Item>
					<TerminalModal serverId="local">
						<span>Terminal</span>
					</TerminalModal>
					<ShowModalLogs appName="docklands">
						<DropdownMenu.Item
							className="cursor-pointer"
							onSelect={(e) => e.preventDefault()}
						>
							View Logs
						</DropdownMenu.Item>
					</ShowModalLogs>
					<GPUSupportModal />
					<UpdateServerIp>
						<DropdownMenu.Item
							className="cursor-pointer"
							onSelect={(e) => e.preventDefault()}
						>
							Update Server IP
						</DropdownMenu.Item>
					</UpdateServerIp>

					<DropdownMenu.Item
						className="cursor-pointer"
						onClick={async () => {
							await cleanRedis()
								.then(async () => {
									toast.success("Redis cleaned");
								})
								.catch(() => {
									toast.error("Error cleaning Redis");
								});
						}}
					>
						Clean Redis
					</DropdownMenu.Item>

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
						Clean all deployment queue
					</DropdownMenu.Item>

					<DropdownMenu.Item
						className="cursor-pointer"
						onClick={async () => {
							await reloadRedis()
								.then(async () => {
									toast.success("Redis reloaded");
								})
								.catch(() => {
									toast.error("Error reloading Redis");
								});
						}}
					>
						Reload Redis
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
