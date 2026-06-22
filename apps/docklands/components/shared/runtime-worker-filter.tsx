import { Badge } from "@cloudflare/kumo/components/badge";
import { LinkButton } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Loader2, PlusIcon, ServerIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { api } from "@/client/api/trpc";

const LOCAL_RUNTIME_WORKER = "docklands-local-runtime";

interface Props {
	children: (serverId?: string) => ReactNode;
}

export const RuntimeWorkerFilter = ({ children }: Props) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentPathname = pathname ?? "/dashboard/workspace";
	const { data: servers, isLoading: isLoadingServers } =
		api.runtimeWorker.withSSHKey.useQuery();
	const { data: isCloud, isLoading: isLoadingCloud } =
		api.settings.isCloud.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();

	const queryServerId =
		searchParams?.get("runtimeWorkerId") ??
		searchParams?.get("serverId") ??
		undefined;

	const selectedServer = servers?.find(
		(server) => server.serverId === queryServerId,
	);
	// Cloud has no local runtime, so fall back to the first remote runtime.
	const serverId = selectedServer
		? selectedServer.serverId
		: isCloud
			? servers?.[0]?.serverId
			: undefined;

	const setServerId = (value: string) => {
		const query = new URLSearchParams(searchParams?.toString() ?? "");
		query.delete("serverId");
		if (value === LOCAL_RUNTIME_WORKER) {
			query.delete("runtimeWorkerId");
		} else {
			query.set("runtimeWorkerId", value);
		}
		const suffix = query.toString();
		router.replace(suffix ? `${currentPathname}?${suffix}` : currentPathname, {
			scroll: false,
		});
	};

	if (isLoadingServers || isLoadingCloud) {
		return (
			<div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-2 rounded-lg border bg-background">
				<span className="text-lg font-medium text-muted-foreground">
					Loading...
				</span>
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (isCloud && !servers?.length) {
		return (
			<div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 rounded-lg border border-dashed bg-background px-4">
				<div className="flex size-16 items-center justify-center rounded-full bg-muted">
					<ServerIcon className="size-8 text-muted-foreground" />
				</div>
				<div className="flex max-w-md flex-col items-center gap-1.5 text-center">
					<span className="text-lg font-medium">No runtime workers yet</span>
					<span className="text-sm text-muted-foreground">
						{permissions?.server.create
							? "This section works on remote runtime workers. Add your first worker to start managing it from here."
							: "This section works on remote runtime workers. Ask an administrator to add a worker to your organization."}
					</span>
				</div>
				{permissions?.server.create && (
					<LinkButton href="/dashboard/settings/runtime">
						<PlusIcon className="size-4" />
						Add worker
					</LinkButton>
				)}
			</div>
		);
	}

	return (
		<div className="flex w-full flex-col gap-4">
			{!!servers?.length && (
				<div className="flex w-full items-center justify-end gap-3">
					<Label
						htmlFor="runtime-worker-filter"
						className="whitespace-nowrap text-sm text-muted-foreground"
					>
						Runtime worker
					</Label>
					<Select
						aria-label="Runtime worker filter"
						value={serverId ?? LOCAL_RUNTIME_WORKER}
						onValueChange={(value) =>
							value !== null && setServerId(value as never)
						}
					>
						<>
							<div className="flex items-center gap-2">
								<ServerIcon className="size-4 text-muted-foreground" />
							</div>
						</>
						<>
							<Select.Group>
								<Select.GroupLabel>Runtime workers</Select.GroupLabel>
								{!isCloud && (
									<Select.Option value={LOCAL_RUNTIME_WORKER}>
										<div className="flex items-center gap-2">
											<span>Local runtime worker</span>
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
			<Fragment key={serverId ?? LOCAL_RUNTIME_WORKER}>
				{children(serverId)}
			</Fragment>
		</div>
	);
};
