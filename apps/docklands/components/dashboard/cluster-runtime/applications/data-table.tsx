"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import {
	type ColumnDef,
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
import { ChevronDown } from "lucide-react";
import React from "react";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
}

export function DataTable<TData, TValue>({
	columns,
	data,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = React.useState({});
	const [_pagination, _setPagination] = React.useState({
		pageIndex: 0, //initial page index
		pageSize: 8, //default page size
	});

	const table = useReactTable({
		data,
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
		<div className="mt-6 grid gap-4 pb-20 w-full">
			<div className="flex flex-col gap-4 w-full overflow-auto">
				<div className="flex items-center gap-2 max-sm:flex-wrap">
					<Input
						placeholder="Filter by name..."
						value={(table.getColumn("Name")?.getFilterValue() as string) ?? ""}
						onChange={(event) =>
							table.getColumn("Name")?.setFilterValue(event.target.value)
						}
						className="md:max-w-sm"
					/>
					<DropdownMenu>
						<DropdownMenu.Trigger
							render={
								<Button variant="outline" className="sm:ml-auto max-sm:w-full">
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
									{/* {isPending ? (
                    <div className="w-full flex-col gap-2 flex items-center justify-center h-[55vh]">
                      <span className="text-muted-foreground text-lg font-medium">
                        Loading...
                      </span>
                    </div>
                  ) : (
                    <>No results.</>
                  )} */}
								</Table.Cell>
							</Table.Row>
						)}
					</Table.Body>
				</Table>

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
	);
}
