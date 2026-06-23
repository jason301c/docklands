"use client";

import { CommandPalette } from "@cloudflare/kumo/components/command-palette";
import { BookIcon, CircuitBoard, GlobeIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { api } from "@/client/api/trpc";
import {
	extractServices,
	type Services,
} from "@/components/dashboard/settings/users/add-permissions";
import {
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import {
	isEnvironmentCanvasPath,
	workspaceEnvironmentPath,
	workspaceListPath,
	workspaceOverviewPath,
	workspaceServicePath,
} from "@/shared/routes";
import { StatusTooltip } from "../shared/status-tooltip";

type SearchServices = Services & {
	environmentId: string;
	environmentName: string;
};

type SearchItem = {
	id: string;
	title: string;
	searchText: string;
	icon?: React.ReactNode;
	status?: "running" | "error" | "done" | "idle" | "cancelled" | null;
	onSelect: () => void;
};

type SearchGroup = {
	label: string;
	items: SearchItem[];
};

const extractAllServicesFromProject = (workspace: any): SearchServices[] => {
	const allServices: SearchServices[] = [];

	workspace.environments?.forEach((environment: any) => {
		const environmentServices = extractServices(environment);
		const servicesWithEnvironmentId: SearchServices[] = environmentServices.map(
			(service) => ({
				...service,
				environmentId: environment.environmentId,
				environmentName: environment.name,
			}),
		);
		allServices.push(...servicesWithEnvironmentId);
	});

	return allServices;
};

const toStatusTooltipStatus = (
	status?: string | null,
): SearchItem["status"] => {
	if (
		status === "running" ||
		status === "error" ||
		status === "done" ||
		status === "idle" ||
		status === "cancelled"
	) {
		return status;
	}
	return null;
};

const serviceIcon = (type: string) => {
	if (type === "postgres") return <PostgresqlIcon className="h-6 w-6 mr-2" />;
	if (type === "redis") return <RedisIcon className="h-6 w-6 mr-2" />;
	if (type === "mariadb") return <MariadbIcon className="h-6 w-6 mr-2" />;
	if (type === "mongo") return <MongodbIcon className="h-6 w-6 mr-2" />;
	if (type === "mysql") return <MysqlIcon className="h-6 w-6 mr-2" />;
	if (type === "application") return <GlobeIcon className="h-6 w-6 mr-2" />;
	if (type === "compose") return <CircuitBoard className="h-6 w-6 mr-2" />;
	return null;
};

export const SearchCommand = () => {
	const router = useRouter();
	const pathname = usePathname();
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const { data: session } = api.user.session.useQuery();
	const { data } = api.workspaces.all.useQuery(undefined, {
		enabled: !!session,
	});

	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			const isShortcut =
				(e.code === "KeyK" || e.code === "KeyJ") && (e.metaKey || e.ctrlKey);
			const canvasOwnsCommandK =
				e.code === "KeyK" && isEnvironmentCanvasPath(pathname ?? "");

			if (isShortcut && !canvasOwnsCommandK) {
				e.preventDefault();
				setOpen((current) => !current);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [pathname]);

	const groups = React.useMemo<SearchGroup[]>(() => {
		const navigate = (href: string) => {
			router.push(href);
			setOpen(false);
		};

		const workspaces: SearchItem[] =
			data?.flatMap((workspace) => {
				const defaultEnvironment =
					workspace.environments.find((environment) => environment.isDefault) ||
					workspace.environments?.[0];
				if (!defaultEnvironment) return [];

				const title = `${workspace.name} / ${defaultEnvironment.name}`;
				return [
					{
						id: `workspace-${workspace.workspaceId}`,
						title,
						searchText: title.toLowerCase(),
						icon: <BookIcon className="size-4 text-kumo-subtle mr-2" />,
						onSelect: () =>
							navigate(
								workspaceEnvironmentPath({
									workspaceId: workspace.workspaceId,
									environmentId: defaultEnvironment.environmentId,
								}),
							),
					},
				];
			}) ?? [];

		const services: SearchItem[] =
			data?.flatMap((workspace) =>
				extractAllServicesFromProject(workspace).map((service) => {
					const title = `${workspace.name} / ${service.environmentName} / ${service.name}`;
					return {
						id: `service-${service.type}-${service.id}`,
						title,
						searchText: `${title} ${service.id} ${service.type}`.toLowerCase(),
						icon: serviceIcon(service.type),
						status: toStatusTooltipStatus(service.status),
						onSelect: () =>
							navigate(
								workspaceServicePath({
									workspaceId: workspace.workspaceId,
									environmentId: service.environmentId,
									serviceType: service.type,
									serviceId: service.id,
								}),
							),
					};
				}),
			) ?? [];

		const applicationItems: SearchItem[] = [
			{
				id: "app-workspace",
				title: "Workspace",
				searchText: "workspace overview dashboard home",
				onSelect: () => navigate(workspaceOverviewPath),
			},
			{
				id: "app-workspaces",
				title: "Workspaces",
				searchText: "workspaces workspaces list",
				onSelect: () => navigate(workspaceListPath),
			},
			{
				id: "app-deployments",
				title: "Deployments",
				searchText: "deployments builds releases history worker queue",
				onSelect: () => navigate("/dashboard/deployments"),
			},
			{
				id: "app-automations",
				title: "Automations",
				searchText: "automations schedules cron jobs tasks",
				onSelect: () => navigate("/dashboard/automations"),
			},
			{
				id: "app-monitoring",
				title: "Host metrics",
				searchText: "host metrics monitoring runtime",
				onSelect: () => navigate("/dashboard/host-metrics"),
			},
			{
				id: "app-traefik",
				title: "Ingress files",
				searchText: "ingress files traefik proxy",
				onSelect: () => navigate("/dashboard/proxy-files"),
			},
			{
				id: "app-docker",
				title: "Container runtime",
				searchText: "runtime containers docker",
				onSelect: () => navigate("/dashboard/container-runtime"),
			},
			{
				id: "app-cluster-runtime",
				title: "Cluster runtime",
				searchText: "cluster runtime workers swarm orchestration",
				onSelect: () => navigate("/dashboard/cluster-runtime"),
			},
			{
				id: "app-requests",
				title: "Ingress requests",
				searchText: "ingress requests runtime proxy",
				onSelect: () => navigate("/dashboard/requests"),
			},
			{
				id: "app-settings",
				title: "Ingress settings",
				searchText: "settings ingress domains tls proxy",
				onSelect: () => navigate("/dashboard/settings/ingress"),
			},
			{
				id: "app-runtime-settings",
				title: "Runtime worker settings",
				searchText: "settings runtime workers servers",
				onSelect: () => navigate("/dashboard/settings/runtime"),
			},
			{
				id: "app-image-registry-settings",
				title: "Image registry settings",
				searchText: "settings image registry container credentials",
				onSelect: () => navigate("/dashboard/settings/image-registry"),
			},
			{
				id: "app-storage-settings",
				title: "Storage settings",
				searchText: "settings storage s3 destinations backups",
				onSelect: () => navigate("/dashboard/settings/storage"),
			},
			{
				id: "app-build-workers-settings",
				title: "Build worker settings",
				searchText: "settings build workers concurrency queue",
				onSelect: () => navigate("/dashboard/settings/build-workers"),
			},
		];

		return [
			{ label: "Workspaces", items: workspaces },
			{ label: "Services", items: services },
			{ label: "Application", items: applicationItems },
		].filter((group) => group.items.length > 0);
	}, [data, router]);

	const filteredGroups = React.useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return groups;

		return groups
			.map((group) => ({
				...group,
				items: group.items.filter((item) => item.searchText.includes(query)),
			}))
			.filter((group) => group.items.length > 0);
	}, [groups, search]);

	return (
		<CommandPalette.Root
			open={open}
			onOpenChange={setOpen}
			items={filteredGroups}
			value={search}
			onValueChange={(value) => value !== null && setSearch(value as never)}
			itemToStringValue={(group: SearchGroup) => group.label}
			getSelectableItems={(items: SearchGroup[]) =>
				items.flatMap((group) => group.items)
			}
			onSelect={(item: SearchItem) => item.onSelect()}
		>
			<CommandPalette.Input placeholder="Search workspaces, services, or settings" />
			<CommandPalette.List>
				<CommandPalette.Results>
					{(group: SearchGroup) => (
						<CommandPalette.Group items={group.items}>
							<CommandPalette.GroupLabel>
								{group.label}
							</CommandPalette.GroupLabel>
							<CommandPalette.Items>
								{(item: SearchItem) => (
									<CommandPalette.Item
										key={item.id}
										value={item}
										onClick={item.onSelect}
									>
										{item.icon}
										<span className="flex-grow">{item.title}</span>
										{item.status && (
											<div>
												<StatusTooltip status={item.status} />
											</div>
										)}
									</CommandPalette.Item>
								)}
							</CommandPalette.Items>
						</CommandPalette.Group>
					)}
				</CommandPalette.Results>
				<CommandPalette.Empty>No results found.</CommandPalette.Empty>
			</CommandPalette.List>
		</CommandPalette.Root>
	);
};
