"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { columns as defaultColumns, STATUS_OPTIONS, type FileModel } from "./columns";
import { DataTableViewOptions } from "./data-table-view-options";
import { FileStatusFilter } from "./file-status-filter";
import { FileActions } from "./file-actions";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

interface DataTableProps {
  columns?: ColumnDef<FileModel, unknown>[];
  data: FileModel[];
  onSelectionChange?: (selected: FileModel[]) => void;
  onProcessComplete?: () => void;
}

export function DataTable({
  columns = defaultColumns,
  data,
  onSelectionChange,
  onProcessComplete,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE_OPTIONS[0],
  });

  const tableColumns = React.useMemo<ColumnDef<FileModel, unknown>[]>(
    () => [
      ...columns,
      {
        id: "__actions",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => {
          const selected = table.getSelectedRowModel().rows.map((row) => row.original);
          return (
            <div className="flex justify-end">
              <FileActions selectedFiles={selected} onProcessComplete={onProcessComplete} />
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <FileActions selectedFiles={[row.original]} onProcessComplete={onProcessComplete} />
          </div>
        ),
      },
    ],
    [columns, onProcessComplete],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
  });

  React.useEffect(() => {
    if (!onSelectionChange) {
      return;
    }
    onSelectionChange(table.getSelectedRowModel().rows.map((row) => row.original));
  }, [onSelectionChange, rowSelection, table]);

  React.useEffect(() => {
    setRowSelection({});
  }, [data]);

  const isFiltered = table.getState().columnFilters.length > 0;
  const paginationState = table.getState().pagination;
  const pageSize = paginationState.pageSize;
  const pageIndex = paginationState.pageIndex;
  const totalRows = table.getFilteredRowModel().rows.length;
  const currentRows = table.getRowModel().rows.length;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = totalRows === 0 ? 0 : firstRow + currentRows - 1;

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search files..."
            value={(table.getColumn("fileName")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("fileName")?.setFilterValue(event.target.value)}
            className="h-9 w-full max-w-sm"
          />
          <FileStatusFilter column={table.getColumn("status")} options={STATUS_OPTIONS} />
          {isFiltered && (
            <Button variant="ghost" className="h-9 px-2" onClick={() => table.resetColumnFilters()}>
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
          <div className="ml-auto">
            <DataTableViewOptions table={table} />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 border-t border-border/60 py-4 text-sm text-muted-foreground">
        <div className="flex w-full flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
          <span>
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected
          </span>
          <span className="ml-auto text-muted-foreground">
            Showing {firstRow.toLocaleString()} – {lastRow.toLocaleString()} of{" "}
            {totalRows.toLocaleString()}
          </span>
        </div>
        <DataTablePagination table={table} />
      </CardFooter>
    </Card>
  );
}

function DataTablePagination({ table }: { table: TanstackTable<FileModel> }) {
  const pagination = table.getState().pagination;
  const pageSize = pagination.pageSize;
  const pageIndex = pagination.pageIndex;
  const pageCount = table.getPageCount() || 1;
  const pages = getPaginationPages(pageIndex, pageCount);
  const canPrevious = table.getCanPreviousPage();
  const canNext = table.getCanNextPage();

  return (
    <div className="flex w-full flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Label
          htmlFor="rows-per-page"
          className="inline-flex items-center whitespace-nowrap text-xs font-semibold text-muted-foreground"
        >
          Rows per page
        </Label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger id="rows-per-page" className="h-9 w-32">
            <SelectValue placeholder={`${pageSize}`} />
          </SelectTrigger>
          <SelectContent align="start">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Pagination fullWidth={false} className="ml-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className={!canPrevious ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (canPrevious) {
                  table.previousPage();
                }
              }}
            />
          </PaginationItem>
          {renderPaginationItems(pages, pageIndex, (page) => table.setPageIndex(page))}
          <PaginationItem>
            <PaginationNext
              href="#"
              className={!canNext ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (canNext) {
                  table.nextPage();
                }
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function renderPaginationItems(
  pages: number[],
  activePage: number,
  onSelect: (page: number) => void,
) {
  const items: React.ReactNode[] = [];
  let previousPage = -1;

  pages.forEach((page) => {
    if (previousPage !== -1 && page - previousPage > 1) {
      items.push(
        <PaginationItem key={`ellipsis-${page}`}>
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    items.push(
      <PaginationItem key={page}>
        <PaginationLink
          href="#"
          size="default"
          isActive={activePage === page}
          onClick={(event) => {
            event.preventDefault();
            onSelect(page);
          }}
        >
          {page + 1}
        </PaginationLink>
      </PaginationItem>,
    );

    previousPage = page;
  });

  return items;
}

function getPaginationPages(current: number, total: number) {
  const pages = new Set<number>();

  if (total <= 0) {
    return [0];
  }

  pages.add(0);
  pages.add(total - 1);

  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 0 && i < total) {
      pages.add(i);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}
