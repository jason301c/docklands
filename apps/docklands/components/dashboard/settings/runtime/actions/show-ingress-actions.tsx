import { Button } from "@cloudflare/kumo/components/button";
import { api } from "@/client/api/trpc";
import { useHealthCheckAfterMutation } from "@/client/hooks/use-health-check-after-mutation";
import { EditIngressEnv } from "@/components/dashboard/settings/ingress-runtime/edit-ingress-env";
import { ManageIngressPorts } from "@/components/dashboard/settings/ingress-runtime/manage-ingress-ports";
import { ServiceLogsModal } from "@/components/dashboard/shared/service-logs-modal";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { DropdownMenu } from "@/components/shared/dropdown";
import { toast } from "@/components/shared/toast";

interface Props {
	runtimeWorkerId?: string;
}
export const ShowIngressActions = ({ runtimeWorkerId }: Props) => {
	const { mutateAsync: reloadTraefik, isPending: reloadTraefikIsLoading } =
		api.settings.reloadTraefik.useMutation();

	const { mutateAsync: toggleDashboard, isPending: toggleDashboardIsLoading } =
		api.settings.toggleDashboard.useMutation();

	const { data: haveTraefikDashboardPortEnabled, refetch: refetchDashboard } =
		api.settings.haveTraefikDashboardPortEnabled.useQuery({
			runtimeWorkerId,
		});

	const {
		execute: executeWithHealthCheck,
		isExecuting: isHealthCheckExecuting,
	} = useHealthCheckAfterMutation({
		initialDelay: 5000,
		pollInterval: 4000,
		successMessage: "Ingress dashboard updated successfully",
		onSuccess: () => {
			refetchDashboard();
		},
	});

	const {
		execute: executeReloadWithHealthCheck,
		isExecuting: isReloadHealthCheckExecuting,
	} = useHealthCheckAfterMutation({
		initialDelay: 5000,
		pollInterval: 4000,
		successMessage: "Ingress reloaded",
	});

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				disabled={
					reloadTraefikIsLoading ||
					toggleDashboardIsLoading ||
					isHealthCheckExecuting ||
					isReloadHealthCheckExecuting
				}
				render={
					<Button
						loading={
							reloadTraefikIsLoading ||
							toggleDashboardIsLoading ||
							isHealthCheckExecuting ||
							isReloadHealthCheckExecuting
						}
						variant="outline"
					>
						Ingress
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
							try {
								await executeReloadWithHealthCheck(() =>
									reloadTraefik({ runtimeWorkerId }),
								);
							} catch (error) {
								const errorMessage =
									(error as Error)?.message ||
									"Failed to reload ingress. Please try again.";
								toast.error(errorMessage);
							}
						}}
						className="cursor-pointer"
						disabled={isReloadHealthCheckExecuting}
					>
						<span>Reload</span>
					</DropdownMenu.Item>
					<ServiceLogsModal
						appName="docklands-traefik"
						runtimeWorkerId={runtimeWorkerId}
						type="standalone"
					>
						<DropdownMenu.Item
							onSelect={(e) => e.preventDefault()}
							className="cursor-pointer"
						>
							View Logs
						</DropdownMenu.Item>
					</ServiceLogsModal>
					<EditIngressEnv runtimeWorkerId={runtimeWorkerId}>
						<DropdownMenu.Item
							onSelect={(e) => e.preventDefault()}
							className="cursor-pointer"
						>
							<span>Modify Environment</span>
						</DropdownMenu.Item>
					</EditIngressEnv>

					<DialogAction
						title={
							haveTraefikDashboardPortEnabled
								? "Disable Ingress Dashboard"
								: "Enable Ingress Dashboard"
						}
						description={
							<div className="space-y-4">
								<AlertBlock type="warning">
									The ingress proxy will be recreated from scratch. This means
									the container will be deleted and created again, which may
									cause downtime in your applications.
								</AlertBlock>
								<p>
									Are you sure you want to{" "}
									{haveTraefikDashboardPortEnabled ? "disable" : "enable"} the
									ingress dashboard?
								</p>
							</div>
						}
						onClick={async () => {
							try {
								await executeWithHealthCheck(() =>
									toggleDashboard({
										enableDashboard: !haveTraefikDashboardPortEnabled,
										runtimeWorkerId: runtimeWorkerId,
									}),
								);
							} catch (error) {
								const errorMessage =
									(error as Error)?.message ||
									"Failed to toggle dashboard. Please check if port 8080 is available.";
								toast.error(errorMessage);
							}
						}}
						disabled={toggleDashboardIsLoading || isHealthCheckExecuting}
						type="default"
					>
						<DropdownMenu.Item
							onSelect={(e) => e.preventDefault()}
							className="w-full cursor-pointer space-x-3"
						>
							<span>
								{haveTraefikDashboardPortEnabled ? "Disable" : "Enable"}{" "}
								Dashboard
							</span>
						</DropdownMenu.Item>
					</DialogAction>
					<ManageIngressPorts runtimeWorkerId={runtimeWorkerId}>
						<DropdownMenu.Item
							onSelect={(e) => e.preventDefault()}
							className="cursor-pointer"
						>
							<span>Additional Port Mappings</span>
						</DropdownMenu.Item>
					</ManageIngressPorts>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
