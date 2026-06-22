import { Button } from "@cloudflare/kumo/components/button";
import {
	AlertCircle,
	AlertTriangle,
	ExternalLink,
	Info,
	RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/alert";
import type { ContainerInfo } from "./types";

export const DocLinks = () => (
	<div className="flex flex-col gap-1 pt-2 border-t mt-2">
		<p className="text-xs font-medium text-muted-foreground">
			Helpful resources:
		</p>
		<div className="flex flex-wrap gap-x-4 gap-y-1">
			<a
				href="https://github.com/jason301c/docklands"
				target="_blank"
				rel="noopener noreferrer"
				className="text-xs text-primary underline underline-offset-4 inline-flex items-center gap-1"
			>
				Docklands Documentation
				<ExternalLink className="h-3 w-3" />
			</a>
			<a
				href="https://docs.docker.com/engine/swarm/"
				target="_blank"
				rel="noopener noreferrer"
				className="text-xs text-primary underline underline-offset-4 inline-flex items-center gap-1"
			>
				Docker Swarm engine guide
				<ExternalLink className="h-3 w-3" />
			</a>
			<Link
				href="/dashboard/settings/cluster-nodes"
				className="text-xs text-primary underline underline-offset-4 inline-flex items-center gap-1"
			>
				Cluster Nodes
			</Link>
		</div>
	</div>
);

interface SwarmNotAvailableProps {
	errorMessage?: string;
	onRetry: () => void;
}

export const SwarmNotAvailable = ({
	errorMessage,
	onRetry,
}: SwarmNotAvailableProps) => (
	<div className="flex flex-col gap-4 py-6 max-w-2xl mx-auto">
		<Alert variant="destructive">
			<AlertTriangle className="h-4 w-4" />
			<AlertTitle>Orchestration Not Available</AlertTitle>
			<AlertDescription>
				Could not reach the orchestration layer.{" "}
				{errorMessage && (
					<span className="block mt-1 text-xs opacity-80">{errorMessage}</span>
				)}
			</AlertDescription>
		</Alert>
		<div className="space-y-3 text-sm text-muted-foreground">
			<p>
				This view uses Docker Swarm under the hood, so the runtime worker needs
				orchestration initialized before Docklands can list scheduled services.
			</p>
			<ol className="list-decimal list-inside space-y-2 ml-1">
				<li>
					Initialize orchestration on your runtime worker:{" "}
					<code className="bg-muted px-1.5 py-0.5 rounded text-xs">
						docker swarm init
					</code>
				</li>
				<li>
					Verify it&apos;s active:{" "}
					<code className="bg-muted px-1.5 py-0.5 rounded text-xs">
						docker info | grep Swarm
					</code>
				</li>
				<li>
					Check the{" "}
					<Link
						href="/dashboard/settings/cluster-nodes"
						className="text-primary underline underline-offset-4"
					>
						Cluster Nodes
					</Link>{" "}
					page to manage your workers
				</li>
			</ol>
			<DocLinks />
		</div>
		<Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
			<RefreshCw className="h-4 w-4 mr-2" />
			Retry
		</Button>
	</div>
);

interface ServicesErrorProps {
	errorMessage?: string;
	onRetry: () => void;
}

export const ServicesError = ({
	errorMessage,
	onRetry,
}: ServicesErrorProps) => (
	<div className="flex flex-col gap-4 py-6 max-w-2xl mx-auto">
		<Alert variant="destructive">
			<AlertTriangle className="h-4 w-4" />
			<AlertTitle>Failed to Load Services</AlertTitle>
			<AlertDescription>
				Orchestration is reachable but service listing failed.{" "}
				{errorMessage && (
					<span className="block mt-1 text-xs opacity-80">{errorMessage}</span>
				)}
			</AlertDescription>
		</Alert>
		<div className="space-y-3 text-sm text-muted-foreground">
			<p>This could be caused by:</p>
			<ul className="list-disc list-inside space-y-1 ml-1">
				<li>Permission issues running Docker commands on the runtime worker</li>
				<li>Docker daemon not responding</li>
				<li>
					Network connectivity issues to a remote worker &mdash; check{" "}
					<Link
						href="/dashboard/settings/cluster-nodes"
						className="text-primary underline underline-offset-4"
					>
						Cluster Nodes
					</Link>
				</li>
			</ul>
		</div>
		<Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
			<RefreshCw className="h-4 w-4 mr-2" />
			Retry
		</Button>
	</div>
);

interface NoServicesProps {
	nodeCount: number;
	onRefresh: () => void;
}

export const NoServices = ({ nodeCount, onRefresh }: NoServicesProps) => (
	<div className="flex flex-col gap-4 py-6 max-w-2xl mx-auto">
		<Alert>
			<Info className="h-4 w-4" />
			<AlertTitle>No Orchestrated Services Found</AlertTitle>
			<AlertDescription>
				Orchestration is active with <strong>{nodeCount} worker(s)</strong>, but
				there are no application services running yet.
			</AlertDescription>
		</Alert>
		<div className="space-y-3 text-sm text-muted-foreground">
			<p>
				This view shows containers deployed through the{" "}
				<strong>orchestration layer</strong>. Standalone containers and Compose
				services that are not deployed as stacks won&apos;t appear here.
			</p>
			<p>To see containers in this view, make sure your applications are:</p>
			<ol className="list-decimal list-inside space-y-2 ml-1">
				<li>
					<strong>Deployed as orchestrated services</strong> &mdash; Docklands
					deploys applications this way by default. Compose projects need to use{" "}
					<code className="bg-muted px-1.5 py-0.5 rounded text-xs">Stack</code>{" "}
					type (not{" "}
					<code className="bg-muted px-1.5 py-0.5 rounded text-xs">
						Docker Compose
					</code>
					) to run across workers.
				</li>
				<li>
					<strong>Using a registry</strong> (for multi-node setups) &mdash;
					Worker nodes need to pull images from a shared registry. Configure one
					in{" "}
					<Link
						href="/dashboard/settings/image-registry"
						className="text-primary underline underline-offset-4"
					>
						Image Registry
					</Link>
					.
				</li>
				<li>
					<strong>Successfully built and deployed</strong> &mdash; Check your
					project&apos;s deployment logs for errors.
				</li>
			</ol>
			<DocLinks />
		</div>
		<Button variant="outline" size="sm" className="w-fit" onClick={onRefresh}>
			<RefreshCw className="h-4 w-4 mr-2" />
			Refresh
		</Button>
	</div>
);

interface NoRunningContainersProps {
	serviceCount: number;
	containers: ContainerInfo[];
	onRefresh: () => void;
}

export const NoRunningContainers = ({
	serviceCount,
	containers,
	onRefresh,
}: NoRunningContainersProps) => {
	const hasErrors = containers.some((c) => c.Error && c.Error.trim() !== "");
	return (
		<div className="flex flex-col gap-4 py-6 max-w-2xl mx-auto">
			<Alert>
				<AlertTriangle className="h-4 w-4" />
				<AlertTitle>No Running Containers</AlertTitle>
				<AlertDescription>
					Found <strong>{serviceCount} service(s)</strong> in orchestration, but
					none have running containers.
				</AlertDescription>
			</Alert>
			{hasErrors && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Container Errors Detected</AlertTitle>
					<AlertDescription>
						<ul className="list-disc list-inside space-y-1 mt-1">
							{containers
								.filter((c) => c.Error && c.Error.trim() !== "")
								.slice(0, 5)
								.map((c) => (
									<li key={c.ID} className="text-xs">
										<strong>{c.Name}</strong>: {c.Error}
									</li>
								))}
						</ul>
					</AlertDescription>
				</Alert>
			)}
			<div className="space-y-3 text-sm text-muted-foreground">
				<p>This can happen when:</p>
				<ul className="list-disc list-inside space-y-2 ml-1">
					<li>Services are scaled to 0 replicas</li>
					<li>
						Containers are failing to start &mdash; check deployment logs for
						errors
					</li>
					<li>
						Images can&apos;t be pulled on workers &mdash; verify your{" "}
						<Link
							href="/dashboard/settings/image-registry"
							className="text-primary underline underline-offset-4"
						>
							registry configuration
						</Link>
					</li>
					<li>
						Placement constraints prevent scheduling &mdash; check placement
						rules in your service&apos;s orchestration settings
					</li>
				</ul>
				<DocLinks />
			</div>
			<Button variant="outline" size="sm" className="w-fit" onClick={onRefresh}>
				<RefreshCw className="h-4 w-4 mr-2" />
				Refresh
			</Button>
		</div>
	);
};
