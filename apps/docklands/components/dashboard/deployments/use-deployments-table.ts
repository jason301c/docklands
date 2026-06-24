"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";

export type DeploymentStatusFilter =
	| "all"
	| "running"
	| "done"
	| "error"
	| "cancelled";
export type DeploymentTypeFilter = "all" | "application" | "compose";
export type DeploymentSortField = "createdAt" | "status";

const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Local debounce so typing in the search box doesn't fire a query per keystroke. */
function useDebouncedValue<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(id);
	}, [value, delay]);
	return debounced;
}

/**
 * Drives the centralized deployments table entirely from the server: search,
 * status/type filters, sorting, and pagination are all query inputs, so the
 * browser never holds more than one page. Summary counts come back with each
 * page (computed over the full accessible set) so the stat cards stay stable
 * while filters change.
 */
export function useDeploymentsTable() {
	const [searchInput, setSearchInput] = useState("");
	const search = useDebouncedValue(searchInput, 300);
	const [status, setStatus] = useState<DeploymentStatusFilter>("all");
	const [type, setType] = useState<DeploymentTypeFilter>("all");
	const [sortBy, setSortBy] = useState<DeploymentSortField>("createdAt");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
	const [pageIndex, setPageIndex] = useState(0);
	const [pageSize, setPageSize] = useState<number>(25);

	// Any change to the result shape resets us to the first page.
	useEffect(() => {
		setPageIndex(0);
	}, [search, status, type, sortBy, sortDir, pageSize]);

	const query = api.deployment.allCentralizedPaged.useQuery(
		{
			search: search.trim() || undefined,
			status,
			type,
			sortBy,
			sortDir,
			limit: pageSize,
			offset: pageIndex * pageSize,
		},
		{
			// Keep the previous page visible while the next one loads (no flicker).
			placeholderData: keepPreviousData,
			// Poll fast while a deployment is active; slow heartbeat when idle.
			refetchInterval: (q) =>
				(q.state.data?.counts.active ?? 0) > 0 ? 5000 : 30000,
		},
	);

	const counts = query.data?.counts ?? {
		active: 0,
		successful: 0,
		failed: 0,
		total: 0,
	};
	const total = query.data?.total ?? 0;
	const rows = query.data?.rows ?? [];
	const latestCreatedAt = query.data?.latestCreatedAt ?? null;

	/** Toggle sort: same field flips direction, new field starts descending. */
	const toggleSort = (field: DeploymentSortField) => {
		if (sortBy === field) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortBy(field);
			setSortDir("desc");
		}
	};

	/** Click a stat card to filter by that status; click the active one to clear. */
	const toggleStatus = (next: DeploymentStatusFilter) => {
		setStatus((current) => (current === next ? "all" : next));
	};

	const clearFilters = () => {
		setSearchInput("");
		setStatus("all");
		setType("all");
	};

	const hasFilters = search.trim() !== "" || status !== "all" || type !== "all";
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const canPreviousPage = pageIndex > 0;
	const canNextPage = (pageIndex + 1) * pageSize < total;

	return {
		query,
		rows,
		total,
		counts,
		latestCreatedAt,
		// filters
		searchInput,
		setSearchInput,
		status,
		setStatus,
		toggleStatus,
		type,
		setType,
		hasFilters,
		clearFilters,
		// sorting
		sortBy,
		sortDir,
		toggleSort,
		// pagination
		pageIndex,
		setPageIndex,
		pageSize,
		setPageSize,
		pageCount,
		canPreviousPage,
		canNextPage,
		pageSizes: PAGE_SIZES,
	};
}
