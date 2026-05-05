// data-table.tsx
"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  onRowClick?: (row: TData) => void
  selectedActivity?: string | null
  selectedRowIndex?: TData | null // Expecting the exact row object
}

export function DataTable<TData>({
  columns,
  data,
  onRowClick,
  selectedActivity,
  selectedRowIndex,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(), 
    initialState: {
      pagination: {
        pageSize: 50, 
      },
    },
  })

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 ">
      <div className="overflow-auto rounded-md border flex-1 min-h-0 bg-white">
        <Table>
          <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap font-semibold text-gray-600">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                // --- HIGHLIGHTING LOGIC ---
                // We cast to any to access the dynamic keys safely
                const rowData = row.original as any 
                
                const activityKey = Object.keys(rowData).find(
                  (key) => key.toLowerCase() === "activity" || key.toLowerCase() === "concept:name"
                )
                const rawRowActivity = activityKey ? String(rowData[activityKey]) : ""
                
                const cleanRowActivity = rawRowActivity.replace(/\s+/g, " ").trim()
                const cleanSelectedActivity = selectedActivity ? selectedActivity.replace(/\s+/g, " ").trim() : ""

                const isSelected = selectedRowIndex 
                  ? rowData === selectedRowIndex 
                  : (cleanSelectedActivity && cleanRowActivity === cleanSelectedActivity)

                return (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={`
                      ${onRowClick ? "cursor-pointer hover:bg-blue-50 transition-colors" : ""}
                      ${isSelected ? "bg-blue-100 hover:bg-blue-200" : ""} 
                    `}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap text-sm text-gray-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-end space-x-2 py-4 px-2 border-t bg-gray-50 flex-shrink-0">
        <span className="text-sm text-gray-600">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
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
  )
}