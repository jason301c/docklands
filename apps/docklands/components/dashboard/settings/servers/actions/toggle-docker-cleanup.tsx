import { Label } from "@cloudflare/kumo/components/label";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { HelpCircle } from "lucide-react";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";

interface Props {
	serverId?: string;
}
export const ToggleDockerCleanup = ({ serverId }: Props) => {
	const { data, refetch } = api.settings.getWebServerSettings.useQuery(
		undefined,
		{
			enabled: !serverId,
		},
	);

	const { data: server, refetch: refetchServer } = api.server.one.useQuery(
		{
			serverId: serverId || "",
		},
		{
			enabled: !!serverId,
		},
	);

	const enabled = serverId
		? server?.enableDockerCleanup
		: data?.enableDockerCleanup;

	const { mutateAsync } = api.settings.updateDockerCleanup.useMutation();

	const handleToggle = async (checked: boolean) => {
		try {
			await mutateAsync({
				enableDockerCleanup: checked,
				...(serverId && { serverId }),
			} as {
				enableDockerCleanup: boolean;
				serverId?: string;
			});
			if (serverId) {
				await refetchServer();
			} else {
				await refetch();
			}
			toast.success("Runtime cleanup updated");
		} catch {
			toast.error("Runtime cleanup error");
		}
	};

	return (
		<div className="flex items-center gap-4">
			<Switch checked={!!enabled} onCheckedChange={handleToggle} />
			<TooltipProvider delay={0}>
				<Tooltip
					content={
						<>
							<p>
								Runs a full runtime cleanup daily, pruning stopped containers,
								unused images, volumes, build cache, and system resources. This
								may remove images built for Compose services that run on-demand
								(backup runners, cron jobs, one-off tasks).
							</p>
							<p className="mt-1">
								For custom cleanup strategies, use{" "}
								<a
									href="https://github.com/jason301c/docklands"
									target="_blank"
									rel="noopener noreferrer"
									className="underline text-primary"
								>
									Schedule Jobs
								</a>{" "}
								on your ingress runtime or remote workers.
							</p>
						</>
					}
					side="top"
					className="max-w-sm"
					asChild
				>
					<Label className="text-primary flex items-center gap-1.5 cursor-pointer">
						Daily Runtime Cleanup
						<HelpCircle className="size-4 text-muted-foreground" />
					</Label>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
};
