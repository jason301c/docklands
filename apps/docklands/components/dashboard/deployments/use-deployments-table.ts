"use client";

import type {
	ColumnFiltersState,
	PaginationState,
	SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { api } from "@/client/api/trpc";
import { getServiceInfo } from "./deployments-columns";

export function useDeploymentsTable() {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "createdAt", desc: true },
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 50,
	});

	const { data: deploymentsList, isLoading } =
		api.deployment.allCentralized.useQuery(undefined, {
			// Poll fast while a build is active; drop to a slow heartbeat when idle
			// (instance-wide view, so it must still catch new deployments).
			refetchInterval: (query) =>
				query.state.data?.some((d) => d.status === "running") ? 5000 : 30000,
		});

	const filteredData = useMemo(() => {
		if (!deploymentsList) return [];
		let list = deploymentsList;
		if (statusFilter !== "all") {
			list = list.filter((d) => d.status === statusFilter);
		}
		if (typeFilter === "application") {
			list = list.filter((d) => d.applicationId != null);
		} else if (typeFilter === "compose") {
			list = list.filter((d) => d.composeId != null);
		}
		if (globalFilter.trim()) {
			const q = globalFilter.toLowerCase();
			list = list.filter((d) => {
				const info = getServiceInfo(d);
				if (!info) return false;
				return (
					info.name.toLowerCase().includes(q) ||
					info.workspaceName.toLowerCase().includes(q) ||
					info.environmentName.toLowerCase().includes(q) ||
					(d.title?.toLowerCase().includes(q) ?? false)
				);
			});
		}
		return list;
	}, [deploymentsList, statusFilter, typeFilter, globalFilter]);

	const deploymentStats = useMemo(() => {
		const list = deploymentsList ?? [];
		const active = list.filter((deployment) => deployment.status === "running");
		const failed = list.filter((deployment) => deployment.status === "error");
		const successful = list.filter(
			(deployment) => deployment.status === "done",
		);
		const latest = [...list].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)[0];

		return {
			active: active.length,
			failed: failed.length,
			successful: successful.length,
			total: list.length,
			latest,
		};
	}, [deploymentsList]);

	const recentDeploymentStream = useMemo(
		() =>
			[...filteredData]
				.sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				)
				.slice(0, 5),
		[filteredData],
	);

	return {
		// fetched list + load state
		deploymentsList,
		isLoading,
		// visible rows
		filteredData,
		recentDeploymentStream,
		// derived metric aggregates
		deploymentStats,
		// filter/sort/pagination state the UI binds to
		sorting,
		setSorting,
		columnFilters,
		setColumnFilters,
		globalFilter,
		setGlobalFilter,
		statusFilter,
		setStatusFilter,
		typeFilter,
		setTypeFilter,
		pagination,
		setPagination,
	};
}
