import { Loader2, PlusIcon, ServerIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { api } from "@/client/api/trpc";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";

const DOCKLANDS_SERVER = "docklands-server";

interface Props {
	children: (serverId?: string) => ReactNode;
}

export const ServerFilter = ({ children }: Props) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentPathname = pathname ?? "/dashboard/home";
	const { data: servers, isLoading: isLoadingServers } =
		api.server.withSSHKey.useQuery();
	const { data: isCloud, isLoading: isLoadingCloud } =
		api.settings.isCloud.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const queryServerId = searchParams?.get("serverId") ?? undefined;

	const selectedServer = servers?.find(
		(server) => server.serverId === queryServerId,
	);
	// Cloud has no local Docklands server, so fall back to the first remote server
	const serverId = selectedServer
		? selectedServer.serverId
		: isCloud
			? servers?.[0]?.serverId
			: undefined;

	const setServerId = (value: string) => {
		const query = new URLSearchParams(searchParams?.toString() ?? "");
		if (value === DOCKLANDS_SERVER) {
			query.delete("serverId");
		} else {
			query.set("serverId", value);
		}
		const suffix = query.toString();
		router.replace(suffix ? `${currentPathname}?${suffix}` : currentPathname, {
			scroll: false,
		});
	};

	if (isLoadingServers || isLoadingCloud) {
		return (
			<LayerCard className="bg-sidebar p-2.5 rounded-xl w-full">
				<div className="rounded-xl bg-background shadow-md flex flex-col gap-2 items-center justify-center min-h-[60vh]">
					<span className="text-muted-foreground text-lg font-medium">
						Loading...
					</span>
					<Loader2 className="animate-spin size-8 text-muted-foreground" />
				</div>
			</LayerCard>
		);
	}

	if (isCloud && !servers?.length) {
		return (
			<LayerCard className="bg-sidebar p-2.5 rounded-xl w-full">
				<div className="rounded-xl bg-background shadow-md flex flex-col items-center justify-center gap-5 min-h-[60vh] border border-dashed px-4">
					<div className="flex items-center justify-center size-16 rounded-full bg-muted">
						<ServerIcon className="size-8 text-muted-foreground" />
					</div>
					<div className="flex flex-col items-center gap-1.5 text-center max-w-md">
						<span className="text-lg font-medium">No servers yet</span>
						<span className="text-sm text-muted-foreground">
							{permissions?.server.create
								? "This section works on your remote servers. Add your first server to start managing it from here."
								: "This section works on your remote servers. Ask an administrator to add a server to your organization."}
						</span>
					</div>
					{permissions?.server.create && (
						<LinkButton href="/dashboard/settings/servers">
							<PlusIcon className="size-4" />
							Add Server
						</LinkButton>
					)}
				</div>
			</LayerCard>
		);
	}

	return (
		<div className="flex flex-col gap-4 w-full">
			{!!servers?.length && (
				<div className="flex w-full items-center justify-end gap-3">
					<Label
						htmlFor="server-filter"
						className="text-sm text-muted-foreground whitespace-nowrap"
					>
						Viewing server
					</Label>
					<Select aria-label="Select option"
						value={serverId ?? DOCKLANDS_SERVER}
						onValueChange={(value) => value !== null && setServerId(value as never)}
					>
						<>
							<div className="flex items-center gap-2">
								<ServerIcon className="size-4 text-muted-foreground" />
								
							</div>
						</>
						<>
							<Select.Group>
								<Select.GroupLabel>Servers</Select.GroupLabel>
								{!isCloud && (
									<Select.Option value={DOCKLANDS_SERVER}>
										<div className="flex items-center gap-2">
											<span>Docklands Server</span>
											<Badge
												variant="secondary"
												className="text-[10px] px-1.5 py-0"
											>
												Local
											</Badge>
										</div>
									</Select.Option>
								)}
								{servers.map((server) => (
									<Select.Option key={server.serverId} value={server.serverId}>
										<div className="flex items-center gap-2">
											<span>{server.name}</span>
											<span className="text-xs text-muted-foreground">
												{server.ipAddress}
											</span>
										</div>
									</Select.Option>
								))}
							</Select.Group>
						</>
					</Select>
				</div>
			)}
			<Fragment key={serverId ?? DOCKLANDS_SERVER}>
				{children(serverId)}
			</Fragment>
		</div>
	);
};
