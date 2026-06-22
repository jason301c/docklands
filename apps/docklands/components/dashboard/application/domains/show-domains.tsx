import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import {
	CheckCircle2,
	ChevronDown,
	ExternalLink,
	GlobeIcon,
	InfoIcon,
	LayoutGrid,
	LayoutList,
	Loader2,
	PenBoxIcon,
	RefreshCw,
	Server,
	Trash2,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { createColumns } from "./columns";
import { DnsHelperModal } from "./dns-helper-modal";
import { AddDomain } from "./handle-domain";

export type ValidationState = {
	isLoading: boolean;
	isValid?: boolean;
	error?: string;
	resolvedIp?: string;
	message?: string;
	cdnProvider?: string;
};

export type ValidationStates = Record<string, ValidationState>;

interface Props {
	id: string;
	type: "application" | "compose";
}

export const ShowDomains = ({ id, type }: Props) => {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canCreateDomain = permissions?.domain.create ?? false;
	const canDeleteDomain = permissions?.domain.delete ?? false;
	const { data: application } =
		type === "application"
			? api.application.one.useQuery(
					{
						applicationId: id,
					},
					{
						enabled: !!id,
					},
				)
			: api.compose.one.useQuery(
					{
						composeId: id,
					},
					{
						enabled: !!id,
					},
				);
	const [validationStates, setValidationStates] = useState<ValidationStates>(
		{},
	);
	const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
		if (typeof window !== "undefined") {
			return (
				(localStorage.getItem("domains-view-mode") as "grid" | "table") ??
				"grid"
			);
		}
		return "grid";
	});
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});
	const { data: ip } = api.settings.getIp.useQuery();

	const {
		data,
		refetch,
		isLoading: isLoadingDomains,
	} = type === "application"
		? api.domain.byApplicationId.useQuery(
				{
					applicationId: id,
				},
				{
					enabled: !!id,
				},
			)
		: api.domain.byComposeId.useQuery(
				{
					composeId: id,
				},
				{
					enabled: !!id,
				},
			);

	const { mutateAsync: validateDomain } =
		api.domain.validateDomain.useMutation();
	const { mutateAsync: deleteDomain, isPending: isRemoving } =
		api.domain.delete.useMutation();

	const handleDeleteDomain = async (domainId: string) => {
		try {
			await deleteDomain({ domainId });
			refetch();
			toast.success("Domain deleted successfully");
		} catch {
			toast.error("Error deleting domain");
		}
	};

	const handleValidateDomain = async (host: string) => {
		setValidationStates((prev) => ({
			...prev,
			[host]: { isLoading: true },
		}));

		try {
			const result = await validateDomain({
				domain: host,
				serverIp:
					application?.runtimeWorker?.ipAddress?.toString() ||
					ip?.toString() ||
					"",
			});

			setValidationStates((prev) => ({
				...prev,
				[host]: {
					isLoading: false,
					isValid: result.isValid,
					error: result.error,
					resolvedIp: result.resolvedIp,
					cdnProvider: result.cdnProvider,
					message: result.error && result.isValid ? result.error : undefined,
				},
			}));
		} catch (err) {
			const error = err as Error;
			setValidationStates((prev) => ({
				...prev,
				[host]: {
					isLoading: false,
					isValid: false,
					error: error.message || "Failed to validate domain",
				},
			}));
		}
	};

	const columns = createColumns({
		id,
		type,
		validationStates,
		handleValidateDomain,
		handleDeleteDomain,
		isDeleting: isRemoving,
		ingressAddress:
			application?.runtimeWorker?.ipAddress?.toString() || ip?.toString(),
		canCreateDomain,
		canDeleteDomain,
	});

	const table = useReactTable({
		data: data ?? [],
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	});

	return (
		<div className="flex w-full flex-col gap-5 ">
			<LayerCard className="bg-kumo-canvas">
				<div className="flex flex-row items-center flex-wrap gap-4 justify-between">
					<div className="flex flex-col gap-1">
						<h3 className="text-xl font-semibold">Domains</h3>
						<p>Domains are used to access to the application</p>
					</div>

					<div className="flex flex-row gap-2 flex-wrap">
						{data && data?.length > 0 && (
							<>
								<Button
									aria-label="Toggle domain layout"
									variant="outline"
									shape="square"
									onClick={() => {
										const next = viewMode === "grid" ? "table" : "grid";
										localStorage.setItem("domains-view-mode", next);
										setViewMode(next);
									}}
								>
									{viewMode === "grid" ? (
										<LayoutList className="size-4" />
									) : (
										<LayoutGrid className="size-4" />
									)}
								</Button>
								{canCreateDomain && (
									<AddDomain id={id} type={type}>
										<Button>
											<GlobeIcon className="size-4" /> Add Domain
										</Button>
									</AddDomain>
								)}
							</>
						)}
					</div>
				</div>
				<div className="flex w-full flex-row gap-4">
					{isLoadingDomains ? (
						<div className="flex w-full flex-row gap-4 min-h-[40vh] justify-center items-center">
							<Loader2 className="size-5 animate-spin text-kumo-subtle" />
							<span className="text-base text-kumo-subtle">
								Loading domains...
							</span>
						</div>
					) : data?.length === 0 ? (
						<div className="flex w-full flex-col items-center justify-center gap-3 min-h-[40vh]">
							<GlobeIcon className="size-8 text-kumo-subtle" />
							<span className="text-base text-kumo-subtle">
								To access the application it is required to set at least 1
								domain
							</span>
							{canCreateDomain && (
								<div className="flex flex-row gap-4 flex-wrap">
									<AddDomain id={id} type={type}>
										<Button>
											<GlobeIcon className="size-4" /> Add Domain
										</Button>
									</AddDomain>
								</div>
							)}
						</div>
					) : viewMode === "table" ? (
						<div className="flex flex-col gap-4 w-full">
							<div className="flex items-center gap-2 max-sm:flex-wrap">
								<Input
									aria-label="Filter domains by host"
									placeholder="Filter by host..."
									value={
										(table.getColumn("host")?.getFilterValue() as string) ?? ""
									}
									onChange={(event) =>
										table.getColumn("host")?.setFilterValue(event.target.value)
									}
									className="md:max-w-sm"
								/>
								<DropdownMenu>
									<DropdownMenu.Trigger
										render={
											<Button
												variant="outline"
												className="sm:ml-auto max-sm:w-full"
											>
												Columns <ChevronDown className="ml-2 h-4 w-4" />
											</Button>
										}
									/>
									<DropdownMenu.Content align="end">
										{table
											.getAllColumns()
											.filter((column) => column.getCanHide())
											.map((column) => {
												return (
													<DropdownMenu.CheckboxItem
														key={column.id}
														className="capitalize"
														checked={column.getIsVisible()}
														onCheckedChange={(value) =>
															column.toggleVisibility(!!value)
														}
													>
														{column.id}
													</DropdownMenu.CheckboxItem>
												);
											})}
									</DropdownMenu.Content>
								</DropdownMenu>
							</div>
							<div className="rounded-md border">
								<Table>
									<Table.Header>
										{table.getHeaderGroups().map((headerGroup) => (
											<Table.Row key={headerGroup.id}>
												{headerGroup.headers.map((header) => {
													return (
														<Table.Head key={header.id}>
															{header.isPlaceholder
																? null
																: flexRender(
																		header.column.columnDef.header,
																		header.getContext(),
																	)}
														</Table.Head>
													);
												})}
											</Table.Row>
										))}
									</Table.Header>
									<Table.Body>
										{table?.getRowModel()?.rows?.length ? (
											table.getRowModel().rows.map((row) => (
												<Table.Row
													key={row.id}
													data-state={row.getIsSelected() && "selected"}
												>
													{row.getVisibleCells().map((cell) => (
														<Table.Cell key={cell.id}>
															{flexRender(
																cell.column.columnDef.cell,
																cell.getContext(),
															)}
														</Table.Cell>
													))}
												</Table.Row>
											))
										) : (
											<Table.Row>
												<Table.Cell
													colSpan={columns.length}
													className="h-24 text-center"
												>
													No results.
												</Table.Cell>
											</Table.Row>
										)}
									</Table.Body>
								</Table>
							</div>
							{data && data?.length > 0 && (
								<div className="flex items-center justify-end space-x-2 py-4">
									<div className="space-x-2 flex flex-wrap">
										<Button
											variant="outline"
											size="sm"
											onClick={() => table.previousPage()}
											disabled={!table.getCanPreviousPage()}
										>
											Previous
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => table.nextPage()}
											disabled={!table.getCanNextPage()}
										>
											Next
										</Button>
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 xl:grid-cols-2 w-full min-h-[40vh] ">
							{data?.map((item) => {
								const validationState = validationStates[item.host];
								return (
									<LayerCard
										key={item.domainId}
										className="relative overflow-hidden w-full border transition-all hover:shadow-md bg-transparent h-fit"
									>
										<div className="p-6">
											<div className="flex flex-col gap-4">
												{/* Service & Domain Info */}
												<div className="flex items-center justify-between flex-wrap gap-y-2">
													{item.serviceName && (
														<Badge variant="outline" className="w-fit">
															<Server className="size-3 mr-1" />
															{item.serviceName}
														</Badge>
													)}
													<div className="flex gap-2 flex-wrap">
														{!item.host.includes("sslip.io") && (
															<DnsHelperModal
																domain={{
																	host: item.host,
																	https: item.https,
																	path: item.path || undefined,
																}}
																ingressAddress={
																	application?.runtimeWorker?.ipAddress?.toString() ||
																	ip?.toString()
																}
															/>
														)}
														{canCreateDomain && (
															<AddDomain
																id={id}
																type={type}
																domainId={item.domainId}
															>
																<Button
																	aria-label="Edit domain"
																	variant="ghost"
																	shape="square"
																	className="group hover:bg-kumo-brand/10"
																>
																	<PenBoxIcon className="size-3.5 text-kumo-brand group-hover:text-kumo-brand" />
																</Button>
															</AddDomain>
														)}
														{canDeleteDomain && (
															<DialogAction
																title="Delete Domain"
																description="Are you sure you want to delete this domain?"
																type="destructive"
																onClick={async () => {
																	await deleteDomain({
																		domainId: item.domainId,
																	})
																		.then((_data) => {
																			refetch();
																			toast.success(
																				"Domain deleted successfully",
																			);
																		})
																		.catch(() => {
																			toast.error("Error deleting domain");
																		});
																}}
															>
																<Button
																	aria-label="Delete domain"
																	variant="ghost"
																	shape="square"
																	className="group hover:bg-kumo-danger/10"
																	loading={isRemoving}
																>
																	<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
																</Button>
															</DialogAction>
														)}
													</div>
												</div>
												<div className="w-full break-all">
													<Link
														className="flex items-center gap-2 text-base font-medium hover:underline"
														target="_blank"
														href={`${item.https ? "https" : "http"}://${item.host}${item.path}`}
													>
														{item.host}
														<ExternalLink className="size-4 min-w-4" />
													</Link>
												</div>

												{/* Domain Details */}
												<div className="flex flex-wrap gap-3">
													<TooltipProvider>
														<Tooltip
															content={
																<>
																	<p>URL path for this service</p>
																</>
															}
															asChild
														>
															<Badge variant="secondary">
																<InfoIcon className="size-3 mr-1" />
																Path: {item.path || "/"}
															</Badge>
														</Tooltip>
													</TooltipProvider>

													<TooltipProvider>
														<Tooltip
															content={
																<>
																	<p>Container port exposed</p>
																</>
															}
															asChild
														>
															<Badge variant="secondary">
																<InfoIcon className="size-3 mr-1" />
																Port: {item.port}
															</Badge>
														</Tooltip>
													</TooltipProvider>

													<TooltipProvider>
														<Tooltip
															content={
																<>
																	<p>
																		{item.https
																			? "Secure HTTPS connection"
																			: "Standard HTTP connection"}
																	</p>
																</>
															}
															asChild
														>
															<Badge
																variant={item.https ? "outline" : "secondary"}
															>
																{item.https ? "HTTPS" : "HTTP"}
															</Badge>
														</Tooltip>
													</TooltipProvider>

													{item.certificateType && (
														<TooltipProvider>
															<Tooltip
																content={
																	<>
																		<p>SSL Certificate Provider</p>
																	</>
																}
																asChild
															>
																<Badge variant="outline">
																	Cert: {item.certificateType}
																</Badge>
															</Tooltip>
														</TooltipProvider>
													)}

													{item.middlewares?.map((middleware, index) => (
														<TooltipProvider key={`${middleware}-${index}`}>
															<Tooltip
																content={
																	<>
																		<p>Traefik middleware reference</p>
																	</>
																}
																asChild
															>
																<Badge variant="secondary">
																	<InfoIcon className="size-3 mr-1" />
																	Middleware: {middleware}
																</Badge>
															</Tooltip>
														</TooltipProvider>
													))}

													<TooltipProvider>
														<Tooltip
															content={
																<>
																	{validationState?.error ? (
																		<div className="flex flex-col gap-1">
																			<p className="font-medium text-kumo-danger">
																				Error:
																			</p>
																			<p>{validationState.error}</p>
																		</div>
																	) : (
																		"Click to validate DNS configuration"
																	)}
																</>
															}
															className="max-w-xs"
															asChild
														>
															<Button
																type="button"
																variant="outline"
																size="xs"
																className={
																	validationState?.isValid
																		? "bg-kumo-success/10 text-kumo-success cursor-pointer"
																		: validationState?.error
																			? "bg-kumo-danger/10 text-kumo-danger cursor-pointer"
																			: "bg-kumo-warning/10 text-kumo-warning cursor-pointer"
																}
																onClick={() => handleValidateDomain(item.host)}
															>
																{validationState?.isLoading ? (
																	<>
																		<Loader2 className="size-3 mr-1 animate-spin" />
																		Checking DNS...
																	</>
																) : validationState?.isValid ? (
																	<>
																		<CheckCircle2 className="size-3 mr-1" />
																		{validationState.message &&
																		validationState.cdnProvider
																			? `Behind ${validationState.cdnProvider}`
																			: "DNS Valid"}
																	</>
																) : validationState?.error ? (
																	<>
																		<XCircle className="size-3 mr-1" />
																		{validationState.error}
																	</>
																) : (
																	<>
																		<RefreshCw className="size-3 mr-1" />
																		Validate DNS
																	</>
																)}
															</Button>
														</Tooltip>
													</TooltipProvider>
												</div>
											</div>
										</div>
									</LayerCard>
								);
							})}
						</div>
					)}
				</div>
			</LayerCard>
		</div>
	);
};
