import { Label } from "@cloudflare/kumo/components/label";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { HelpCircle } from "lucide-react";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";

export const ToggleRemoteServersOnly = () => {
	const { data, refetch } = api.settings.getWebServerSettings.useQuery();

	const { mutateAsync } = api.settings.updateRemoteServersOnly.useMutation();

	const handleToggle = async (checked: boolean) => {
		try {
			await mutateAsync({ remoteServersOnly: checked });
			await refetch();
			toast.success("Remote workers only updated");
		} catch {
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
								must be deployed to remote workers. Deploying directly to the
								Docklands host runtime is not allowed.
							</p>
						</>
					}
					side="top"
					className="max-w-sm"
					asChild
				>
					<Label className="text-primary flex items-center gap-1.5 cursor-pointer">
						Remote Workers Only
						<HelpCircle className="size-4 text-muted-foreground" />
					</Label>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
};
