"use client";

import { type Column } from "@tanstack/react-table";
import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { FileModel } from "./columns";

interface FileStatusFilterProps {
  column: Column<FileModel, unknown> | undefined;
  options: readonly { label: string; value: string }[];
}

export function FileStatusFilter({ column, options }: FileStatusFilterProps) {
  if (!column) {
    return null;
  }

  const selectedValues = (column.getFilterValue() as string[]) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full max-w-[160px] justify-start text-xs font-semibold"
        >
          <Filter className="mr-2 h-4 w-4" />
          Status
          {selectedValues.length > 0 && (
            <Badge variant="secondary" className="ml-2 rounded-full px-2 py-0 text-[10px]">
              {selectedValues.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Filter status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              className="capitalize"
              checked={isSelected}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selectedValues, option.value]
                  : selectedValues.filter((value) => value !== option.value);
                column.setFilterValue(next.length ? next : undefined);
              }}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
