"use client";
import { Badge } from "@cloudflare/kumo/components/badge";
import { LinkButton } from "@cloudflare/kumo/components/button";
import {
	ArrowRight,
	CheckCircle2,
	Cloud,
	GitBranch,
	Rocket,
	Server,
} from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { SectionCard } from "@/components/shared/section-card";
import { cn } from "@/shared/utils";

/**
 * The setup hub: the handful of one-time decisions a new self-hoster makes to get
 * Docklands ready — how apps go online, where code comes from, and the first
 * deploy. It lives at the top of the sidebar and doubles as a status view, so
 * each step shows whether it's done. Admin-only (gated by the route).
 */
export function OnboardingSetup() {
	const { can } = usePermissions();

	const { data: cloudflare } = api.cloudflare.get.useQuery(undefined, {
		enabled: can("tunnel", "read"),
	});
	const { data: gitProviders } = api.gitProvider.getAll.useQuery(undefined, {
		enabled: can("gitProviders", "read"),
	});
	const { data: workspaces } = api.workspaces.all.useQuery();

	const cloudflareConnected = !!cloudflare?.connected;
	const hasGitProvider = (gitProviders?.length ?? 0) > 0;
	const hasWorkspace = (workspaces?.length ?? 0) > 0;

	return (
		<SectionCard title="Setup" contentClassName="space-y-6" className="grow-0">
			<p className="max-w-2xl text-sm text-kumo-subtle">
				A few one-time choices get you from a fresh server to your first app
				online. You can revisit any of these later.
			</p>

			{/* Step 1 — Ingress */}
			<SetupStep
				done={cloudflareConnected}
				icon={<Cloud className="size-4" />}
				title="Get your apps online"
				description="Choose how the public reaches your apps. Cloudflare Tunnel is the easiest — no open ports, public IP, manual DNS, or certificate setup."
			>
				{cloudflareConnected ? (
					<div className="flex flex-wrap items-center gap-3">
						<Badge variant="success">Cloudflare connected</Badge>
						<LinkButton
							href="/dashboard/settings/cloudflare"
							variant="secondary"
							size="sm"
						>
							Manage tunnel
							<ArrowRight className="size-4" />
						</LinkButton>
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						<ChoiceCard
							icon={<Cloud className="size-4 text-kumo-brand" />}
							title="Cloudflare Tunnel"
							recommended
							body="No open ports, no public IP, no manual DNS, and free HTTPS. Works on a home server or any VPS."
							cta={
								<LinkButton
									href="/dashboard/settings/cloudflare"
									variant="primary"
									className="w-fit"
								>
									Set up Cloudflare
									<ArrowRight className="size-4" />
								</LinkButton>
							}
						/>
						<ChoiceCard
							icon={<Server className="size-4 text-kumo-subtle" />}
							title="Public IP"
							body="Your server has a public IP and can open ports 80/443. Traefik handles routing and Let's Encrypt certificates."
							cta={
								<LinkButton
									href="/dashboard/settings/ingress"
									variant="secondary"
									className="w-fit"
								>
									Configure ingress
									<ArrowRight className="size-4" />
								</LinkButton>
							}
						/>
					</div>
				)}
			</SetupStep>

			{/* Step 2 — Git */}
			<SetupStep
				done={hasGitProvider}
				icon={<GitBranch className="size-4" />}
				title="Connect a Git provider"
				description="Deploy straight from GitHub, GitLab, Gitea, or Bitbucket on every push."
			>
				<LinkButton
					href="/dashboard/settings/git-providers"
					variant={hasGitProvider ? "secondary" : "primary"}
					size="sm"
				>
					{hasGitProvider ? "Manage providers" : "Connect a provider"}
					<ArrowRight className="size-4" />
				</LinkButton>
			</SetupStep>

			{/* Step 3 — First app */}
			<SetupStep
				done={hasWorkspace}
				icon={<Rocket className="size-4" />}
				title="Deploy your first app"
				description="Create a workspace, drop a service onto the canvas, and ship it."
				last
			>
				<LinkButton
					href="/dashboard/workspace"
					variant={hasWorkspace ? "secondary" : "primary"}
					size="sm"
				>
					{hasWorkspace ? "Open workspaces" : "Create a workspace"}
					<ArrowRight className="size-4" />
				</LinkButton>
			</SetupStep>
		</SectionCard>
	);
}

function SetupStep({
	done,
	icon,
	title,
	description,
	children,
	last,
}: {
	done: boolean;
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
	last?: boolean;
}) {
	return (
		<div className="flex gap-4">
			<div className="flex flex-col items-center">
				<span
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-full border",
						done
							? "border-kumo-success/30 bg-kumo-success/10 text-kumo-success"
							: "bg-kumo-fill/30 text-kumo-subtle",
					)}
				>
					{done ? <CheckCircle2 className="size-4" /> : icon}
				</span>
				{!last && <span className="mt-1 w-px flex-1 bg-kumo-line" />}
			</div>
			<div className="flex flex-1 flex-col gap-3 pb-2">
				<div className="flex items-center gap-2">
					<h3 className="font-medium text-sm">{title}</h3>
					{done && <span className="text-kumo-success text-xs">Done</span>}
				</div>
				<p className="max-w-2xl text-sm text-kumo-subtle">{description}</p>
				{children}
			</div>
		</div>
	);
}

function ChoiceCard({
	icon,
	title,
	body,
	cta,
	recommended,
}: {
	icon: ReactNode;
	title: string;
	body: string;
	cta: ReactNode;
	recommended?: boolean;
}) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border border-kumo-line bg-kumo-canvas p-4">
			<div className="flex items-center gap-2">
				<span className="flex size-8 items-center justify-center rounded-lg bg-kumo-fill/40">
					{icon}
				</span>
				<span className="font-medium text-sm">{title}</span>
				{recommended && (
					<span className="rounded-full bg-kumo-brand/10 px-2 py-0.5 text-kumo-brand text-xs font-medium">
						Recommended
					</span>
				)}
			</div>
			<p className="flex-1 text-sm text-kumo-subtle">{body}</p>
			{cta}
		</div>
	);
}
