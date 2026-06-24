import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { AlertTriangle } from "lucide-react";
import { workspaceOverviewPath } from "@/shared/routes";

/**
 * Full-route error UI for App Router `error.tsx` segment boundaries. Renders a
 * recoverable state (retry + escape hatch back to the workspace overview)
 * instead of Next's default blank error screen.
 */
export function RouteError({
	error,
	reset,
	title = "Something went wrong",
}: {
	error?: Error & { digest?: string };
	reset?: () => void;
	title?: string;
}) {
	return (
		<div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
			<div className="flex size-12 items-center justify-center rounded-full bg-kumo-danger-tint text-kumo-danger">
				<AlertTriangle className="size-6" />
			</div>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{title}</h2>
				<p className="max-w-md text-sm text-kumo-subtle">
					{error?.message ||
						"An unexpected error occurred. You can retry, or head back to your workspaces."}
				</p>
			</div>
			<div className="flex items-center gap-2">
				{reset ? <Button onClick={reset}>Try again</Button> : null}
				<LinkButton href={workspaceOverviewPath} variant="secondary">
					Go to workspaces
				</LinkButton>
			</div>
		</div>
	);
}
