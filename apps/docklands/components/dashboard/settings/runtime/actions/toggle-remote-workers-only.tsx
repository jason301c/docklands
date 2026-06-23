import { Label } from "@cloudflare/kumo/components/label";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { HelpCircle } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("runtime-actions");

export const ToggleRemoteWorkersOnly = () => {
	const { data, refetch } = api.settings.getWebServerSettings.useQuery();

	const { mutateAsync } = api.settings.updateRemoteServersOnly.useMutation();

	const handleToggle = async (checked: boolean) => {
		try {
			await mutateAsync({ remoteServersOnly: checked });
			await refetch();
			toast.success("Remote workers only updated");
		} catch (err) {
			logger.error(err);
			toast.error("Error updating remote workers only");
		}
	};

	return (
		<div className="flex items-center gap-4">
			<Switch
				checked={!!data?.remoteServersOnly}
				onCheckedChange={handleToggle}
			/>
			<TooltipProvider delay={0}>
				<Tooltip
					content={
						<>
							<p>
								When enabled, all services (applications, databases, compose)
								must run on remote workers. Running directly on the Docklands
								host runtime is not allowed.
							</p>
						</>
					}
					side="top"
					className="max-w-sm"
					asChild
				>
					<Label className="text-kumo-brand flex items-center gap-1.5 cursor-pointer">
						Remote Workers Only
						<HelpCircle className="size-4 text-kumo-subtle" />
					</Label>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
};
