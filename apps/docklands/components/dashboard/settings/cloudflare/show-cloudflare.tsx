"use client";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Cloud, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { QueryState } from "@/components/shared/states";

const CREATE_TOKEN_URL = "https://dash.cloudflare.com/profile/api-tokens";

const TUNNEL_STATUS_VARIANT: Record<
	string,
	"success" | "warning" | "error" | "secondary"
> = {
	healthy: "success",
	degraded: "warning",
	down: "error",
	unknown: "secondary",
};

export function ShowCloudflare() {
	const utils = api.useUtils();
	const integrationQuery = api.cloudflare.get.useQuery();
	const tunnelQuery = api.tunnel.get.useQuery();
	const [token, setToken] = useState("");

	const connect = api.cloudflare.connect.useMutation(
		crudMutationOptions({
			successMessage: "Cloudflare connected",
			errorMessage: "Could not connect to Cloudflare",
			loggerScope: "cloudflare",
			toastError: false,
			invalidate: () => utils.cloudflare.get.invalidate(),
			onSuccess: () => setToken(""),
		}),
	);

	const disconnect = api.cloudflare.disconnect.useMutation(
		crudMutationOptions({
			successMessage: "Cloudflare disconnected",
			errorMessage: "Could not disconnect Cloudflare",
			loggerScope: "cloudflare",
			invalidate: async () => {
				await utils.cloudflare.get.invalidate();
				await utils.tunnel.get.invalidate();
			},
		}),
	);

	const refreshZones = api.cloudflare.refreshZones.useMutation(
		crudMutationOptions({
			successMessage: "Zones refreshed",
			errorMessage: "Could not refresh zones",
			loggerScope: "cloudflare",
			invalidate: () => utils.cloudflare.get.invalidate(),
		}),
	);

	const provision = api.tunnel.provision.useMutation(
		crudMutationOptions({
			successMessage: "Tunnel provisioned",
			errorMessage: "Could not provision tunnel",
			loggerScope: "tunnel",
			invalidate: () => utils.tunnel.get.invalidate(),
		}),
	);

	const teardown = api.tunnel.teardown.useMutation(
		crudMutationOptions({
			successMessage: "Tunnel removed",
			errorMessage: "Could not remove tunnel",
			loggerScope: "tunnel",
			invalidate: async () => {
				await utils.tunnel.get.invalidate();
				await utils.domain.invalidate();
			},
		}),
	);

	return (
		<SectionCard
			title="Cloudflare Tunnels"
			actions={
				integrationQuery.data?.connected ? (
					<DialogAction
						title="Disconnect Cloudflare"
						description="Remove the managed tunnel first. Disconnecting Cloudflare is only allowed once no tunnel state remains for Docklands to restart."
						type="destructive"
						onClick={async () => {
							await disconnect.mutateAsync();
						}}
					>
						<Button variant="secondary" size="sm">
							Disconnect
						</Button>
					</DialogAction>
				) : null
			}
		>
			<div className="flex flex-col gap-6">
				<p className="max-w-2xl text-sm text-kumo-subtle">
					A Cloudflare Tunnel is the easiest way to put your apps online: no
					open ports, no public IP, no manual DNS, and free HTTPS. Docklands
					runs the tunnel for you and points each domain at the right service
					automatically.
				</p>

				<QueryState
					query={integrationQuery}
					loadingLabel="Loading Cloudflare status…"
					errorTitle="Could not load Cloudflare status"
				>
					{(integration) =>
						integration.connected ? (
							<div className="flex flex-col gap-6">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="success">Connected</Badge>
									{integration.accountName ? (
										<span className="text-sm text-kumo-subtle">
											{integration.accountName}
										</span>
									) : null}
								</div>

								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between">
										<span className="font-medium text-sm">
											Available domains
										</span>
										<Button
											variant="ghost"
											size="sm"
											loading={refreshZones.isPending}
											onClick={() => refreshZones.mutate()}
										>
											Refresh
										</Button>
									</div>
									{integration.zones.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{integration.zones.map((zone) => (
												<Badge key={zone.id} variant="secondary">
													{zone.name}
												</Badge>
											))}
										</div>
									) : (
										<p className="text-sm text-kumo-subtle">
											No zones found for this token. Add a domain to Cloudflare,
											then refresh.
										</p>
									)}
								</div>

								<div className="rounded-lg border border-kumo-line p-4">
									<QueryState
										query={tunnelQuery}
										loadingLabel="Loading tunnel…"
										errorTitle="Could not load tunnel"
									>
										{(tunnel) =>
											tunnel ? (
												<div className="flex flex-wrap items-center justify-between gap-3">
													<div className="flex items-center gap-2">
														<Cloud className="size-4 text-kumo-subtle" />
														<span className="font-medium text-sm">
															{tunnel.name}
														</span>
														<Badge
															variant={
																TUNNEL_STATUS_VARIANT[tunnel.status] ??
																"secondary"
															}
														>
															{tunnel.status}
														</Badge>
													</div>
													<DialogAction
														title="Remove tunnel"
														description="This deletes the tunnel at Cloudflare and reverts any domains using it back to the public path. This cannot be undone."
														type="destructive"
														onClick={async () => {
															await teardown.mutateAsync({});
														}}
													>
														<Button variant="secondary" size="sm">
															Remove tunnel
														</Button>
													</DialogAction>
												</div>
											) : (
												<div className="flex flex-wrap items-center justify-between gap-3">
													<p className="text-sm text-kumo-subtle">
														No tunnel yet. Provision one to start exposing
														services over Cloudflare.
													</p>
													<Button
														loading={provision.isPending}
														onClick={() => provision.mutate({})}
													>
														Provision tunnel
													</Button>
												</div>
											)
										}
									</QueryState>
								</div>
							</div>
						) : (
							<div className="flex max-w-2xl flex-col gap-4">
								<div className="flex items-start gap-2 rounded-lg border border-kumo-line p-3 text-sm text-kumo-subtle">
									<ShieldCheck className="mt-0.5 size-4 shrink-0" />
									<span>
										Create an API token scoped to{" "}
										<strong>Account · Cloudflare Tunnel · Edit</strong> and{" "}
										<strong>Zone · DNS · Edit</strong> for the domains you want
										to use, then paste it below.
									</span>
								</div>

								{connect.isError ? (
									<AlertBlock type="error">
										{connect.error?.message ??
											"Could not connect to Cloudflare"}
									</AlertBlock>
								) : null}

								<div className="flex flex-col gap-2">
									<Input
										type="password"
										placeholder="Cloudflare API token"
										value={token}
										onChange={(e) => setToken(e.target.value)}
										autoComplete="off"
									/>
									<div className="flex items-center justify-between">
										<a
											href={CREATE_TOKEN_URL}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-kumo-brand text-sm hover:underline"
										>
											Create a token
											<ExternalLink className="size-3.5" />
										</a>
										<Button
											loading={connect.isPending}
											disabled={token.trim().length === 0}
											onClick={() => connect.mutate({ apiToken: token.trim() })}
										>
											Connect
										</Button>
									</div>
								</div>
							</div>
						)
					}
				</QueryState>
			</div>
		</SectionCard>
	);
}
