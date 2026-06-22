import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
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
import { ChevronDown, Container } from "lucide-react";
import * as React from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { columns } from "./columns";

export type Container = NonNullable<
	RouterOutputs["docker"]["getContainers"]
>[0];

interface Props {
	runtimeWorkerId?: string;
}

export const ShowContainers = ({ runtimeWorkerId }: Props) => {
	const { data, isPending } = api.docker.getContainers.useQuery({
		runtimeWorkerId,
	});

	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = React.useState({});

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
		<div className="w-full">
			<div className="rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<Container className="size-6 text-kumo-subtle self-center" />
						Runtime Containers
					</h3>
					<p>Inspect the containers running on this Docklands runtime.</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					<div className="gap-4 pb-20 w-full">
						<div className="flex flex-col gap-4  w-full overflow-auto">
							<div className="flex items-center gap-2 max-sm:flex-wrap">
								<Input
									aria-label="Filter containers by name"
									placeholder="Filter by name..."
									value={
										(table.getColumn("name")?.getFilterValue() as string) ?? ""
									}
									onChange={(event) =>
										table.getColumn("name")?.setFilterValue(event.target.value)
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
								{isPending ? (
									<div className="w-full flex-col gap-2 flex items-center justify-center h-[55vh]">
										<span className="text-kumo-subtle text-lg font-medium">
											Loading...
										</span>
									</div>
								) : data?.length === 0 ? (
									<div className="flex-col gap-2 flex items-center justify-center h-[55vh]">
										<span className="text-kumo-subtle text-lg font-medium">
											No results.
										</span>
									</div>
								) : (
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
														{isPending ? (
															<div className="w-full flex-col gap-2 flex items-center justify-center h-[55vh]">
																<span className="text-kumo-subtle text-lg font-medium">
																	Loading...
																</span>
															</div>
														) : (
															<>No results.</>
														)}
													</Table.Cell>
												</Table.Row>
											)}
										</Table.Body>
									</Table>
								)}
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
					</div>
				</div>
			</div>
		</div>
	);
};
