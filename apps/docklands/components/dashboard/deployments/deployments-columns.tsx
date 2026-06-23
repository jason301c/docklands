"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowUpDown, Boxes, ExternalLink, Rocket } from "lucide-react";
import type { AppRouter } from "@/server/api/root";
import { workspaceServicePath } from "@/shared/routes";

export type DeploymentRow =
	inferRouterOutputs<AppRouter>["deployment"]["allCentralized"][number];

export const statusVariants: Record<
	string,
	| "secondary"
	| "secondary"
	| "destructive"
	| "outline"
	| "warning"
	| "green"
	| "red"
> = {
	running: "warning",
	done: "green",
	error: "red",
	cancelled: "outline",
};

export const statusDotClass: Record<string, string> = {
	running: "bg-kumo-warning",
	done: "bg-kumo-success",
	error: "bg-kumo-danger",
	cancelled: "bg-kumo-fill",
};

export function getServiceInfo(d: DeploymentRow) {
	const app = d.application;
	const comp = d.compose;
	if (app?.environment?.workspace && app.environment) {
		return {
			type: "Application" as const,
			name: app.name,
			workspaceId: app.environment.workspace.workspaceId,
			environmentId: app.environment.environmentId,
			workspaceName: app.environment.workspace.name,
			environmentName: app.environment.name,
			serviceId: app.applicationId,
			href: workspaceServicePath({
				workspaceId: app.environment.workspace.workspaceId,
				environmentId: app.environment.environmentId,
				serviceType: "application",
				serviceId: app.applicationId,
			}),
		};
	}
	if (comp?.environment?.workspace && comp.environment) {
		return {
			type: "Compose" as const,
			name: comp.name,
			workspaceId: comp.environment.workspace.workspaceId,
			environmentId: comp.environment.environmentId,
			workspaceName: comp.environment.workspace.name,
			environmentName: comp.environment.name,
			serviceId: comp.composeId,
			href: workspaceServicePath({
				workspaceId: comp.environment.workspace.workspaceId,
				environmentId: comp.environment.environmentId,
				serviceType: "compose",
				serviceId: comp.composeId,
			}),
		};
	}
	return null;
}

export function createDeploymentsColumns() {
	return [
		{
			id: "serviceName",
			accessorFn: (row: DeploymentRow) => getServiceInfo(row)?.name ?? "",
			header: ({
				column,
			}: {
				column: {
					getIsSorted: () => false | "asc" | "desc";
					toggleSorting: (asc: boolean) => void;
				};
			}) => (
				<Button
					variant="ghost"
					className="-ml-3 h-8"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Service
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
			cell: ({ row }: { row: { original: DeploymentRow } }) => {
				const info = getServiceInfo(row.original);
				if (!info) return <span className="text-kumo-subtle">—</span>;
				return (
					<div className="flex items-center gap-2">
						{info.type === "Application" ? (
							<Rocket className="size-4 text-kumo-subtle shrink-0" />
						) : (
							<Boxes className="size-4 text-kumo-subtle shrink-0" />
						)}
						<div className="flex flex-col min-w-0">
							<span className="font-medium truncate">{info.name}</span>
							<Badge variant="outline" className="w-fit text-[10px]">
								{info.type}
							</Badge>
						</div>
					</div>
				);
			},
		},
		{
			id: "workspaceName",
			accessorFn: (row: DeploymentRow) =>
				getServiceInfo(row)?.workspaceName ?? "",
			header: ({
				column,
			}: {
				column: {
					getIsSorted: () => false | "asc" | "desc";
					toggleSorting: (asc: boolean) => void;
				};
			}) => (
				<Button
					variant="ghost"
					className="-ml-3 h-8"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Workspace
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
			cell: ({ row }: { row: { original: DeploymentRow } }) => {
				const info = getServiceInfo(row.original);
				return (
					<span className="text-kumo-subtle">{info?.workspaceName ?? "—"}</span>
				);
			},
		},
		{
			id: "environmentName",
			accessorFn: (row: DeploymentRow) =>
				getServiceInfo(row)?.environmentName ?? "",
			header: ({
				column,
			}: {
				column: {
					getIsSorted: () => false | "asc" | "desc";
					toggleSorting: (asc: boolean) => void;
				};
			}) => (
				<Button
					variant="ghost"
					className="-ml-3 h-8"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Environment
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
			cell: ({ row }: { row: { original: DeploymentRow } }) => {
				const info = getServiceInfo(row.original);
				return (
					<span className="text-kumo-subtle">
						{info?.environmentName ?? "—"}
					</span>
				);
			},
		},
		{
			accessorKey: "title",
			header: ({
				column,
			}: {
				column: {
					getIsSorted: () => false | "asc" | "desc";
					toggleSorting: (asc: boolean) => void;
				};
			}) => (
				<Button
					variant="ghost"
					className="-ml-3 h-8"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Title
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
			cell: ({ row }: { row: { original: DeploymentRow } }) => (
				<span className="text-sm truncate max-w-[200px] block">
					{row.original.title || "—"}
				</span>
			),
		},
		{
			accessorKey: "status",
			header: ({
				column,
			}: {
				column: {
					getIsSorted: () => false | "asc" | "desc";
					toggleSorting: (asc: boolean) => void;
				};
			}) => (
				<Button
					variant="ghost"
					className="-ml-3 h-8"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Status
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
			cell: ({ row }: { row: { original: DeploymentRow } }) => {
				const status = row.original.status ?? "running";
				return (
					<Badge variant={statusVariants[status] ?? "secondary"}>
						{status}
					</Badge>
				);
			},
		},
		{
			accessorKey: "createdAt",
			header: ({
				column,
			}: {
				column: {
					getIsSorted: () => false | "asc" | "desc";
					toggleSorting: (asc: boolean) => void;
				};
			}) => (
				<Button
					variant="ghost"
					className="-ml-3 h-8"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Created
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
			cell: ({ row }: { row: { original: DeploymentRow } }) => (
				<span className="text-kumo-subtle text-sm whitespace-nowrap">
					{row.original.createdAt
						? new Date(row.original.createdAt).toLocaleString()
						: "—"}
				</span>
			),
		},
		{
			header: "",
			id: "actions",
			enableSorting: false,
			cell: ({ row }: { row: { original: DeploymentRow } }) => {
				const info = getServiceInfo(row.original);
				if (!info) return null;
				return (
					<LinkButton
						href={info.href}
						variant="ghost"
						size="sm"
						className="gap-1"
					>
						<ExternalLink className="size-4" />
						Open
					</LinkButton>
				);
			},
		},
	];
}
