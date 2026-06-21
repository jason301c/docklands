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

const extractAllServicesFromProject = (project: any): SearchServices[] => {
	const allServices: SearchServices[] = [];

	project.environments?.forEach((environment: any) => {
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
	const { data } = api.project.all.useQuery(undefined, {
		enabled: !!session,
	});
	const { data: isCloud } = api.settings.isCloud.useQuery();

	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			const isShortcut =
				(e.code === "KeyK" || e.code === "KeyJ") && (e.metaKey || e.ctrlKey);
			const canvasOwnsCommandK =
				e.code === "KeyK" &&
				/^\/dashboard\/project\/[^/]+\/environment\/[^/]+\/?$/.test(pathname);

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

		const projects: SearchItem[] =
			data?.flatMap((project) => {
				const defaultEnvironment =
					project.environments.find((environment) => environment.isDefault) ||
					project.environments?.[0];
				if (!defaultEnvironment) return [];

				const title = `${project.name} / ${defaultEnvironment.name}`;
				return [
					{
						id: `project-${project.projectId}`,
						title,
						searchText: title.toLowerCase(),
						icon: <BookIcon className="size-4 text-muted-foreground mr-2" />,
						onSelect: () =>
							navigate(
								`/dashboard/project/${project.projectId}/environment/${defaultEnvironment.environmentId}`,
							),
					},
				];
			}) ?? [];

		const services: SearchItem[] =
			data?.flatMap((project) =>
				extractAllServicesFromProject(project).map((service) => {
					const title = `${project.name} / ${service.environmentName} / ${service.name}`;
					return {
						id: `service-${service.type}-${service.id}`,
						title,
						searchText: `${title} ${service.id} ${service.type}`.toLowerCase(),
						icon: serviceIcon(service.type),
						status: toStatusTooltipStatus(service.status),
						onSelect: () =>
							navigate(
								`/dashboard/project/${project.projectId}/environment/${service.environmentId}?serviceType=${service.type}&serviceId=${service.id}`,
							),
					};
				}),
			) ?? [];

		const applicationItems: SearchItem[] = [
			{
				id: "app-projects",
				title: "Projects",
				searchText: "projects",
				onSelect: () => navigate("/dashboard/projects"),
			},
			{
				id: "app-deployments",
				title: "Deployments",
				searchText: "deployments",
				onSelect: () => navigate("/dashboard/deployments"),
			},
			...(!isCloud
				? [
						{
							id: "app-monitoring",
							title: "Runtime metrics",
							searchText: "monitoring metrics runtime",
							onSelect: () => navigate("/dashboard/monitoring"),
						},
						{
							id: "app-traefik",
							title: "Ingress files",
							searchText: "ingress files traefik proxy",
							onSelect: () => navigate("/dashboard/traefik"),
						},
						{
							id: "app-docker",
							title: "Runtime containers",
							searchText: "runtime containers docker",
							onSelect: () => navigate("/dashboard/docker"),
						},
						{
							id: "app-requests",
							title: "Runtime requests",
							searchText: "requests runtime",
							onSelect: () => navigate("/dashboard/requests"),
						},
					]
				: []),
			{
				id: "app-settings",
				title: "Ingress settings",
				searchText: "settings ingress domains tls proxy",
				onSelect: () => navigate("/dashboard/settings/server"),
			},
		];

		return [
			{ label: "Projects", items: projects },
			{ label: "Services", items: services },
			{ label: "Application", items: applicationItems },
		].filter((group) => group.items.length > 0);
	}, [data, isCloud, router]);

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
			<CommandPalette.Input placeholder="Search projects, services, or settings" />
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
