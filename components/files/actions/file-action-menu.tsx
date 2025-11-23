"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileRecord } from "@/lib/files";
import { MoreHorizontal } from "lucide-react";
import { DeleteFilesAction } from "./delete-files-action";
import { DownloadFilesAction } from "./download-files-action";
import { ExportToXmlAction } from "./export-to-xml-action";
import { ProcessFilesAction } from "./process-files-action";
import { ShowDataAction } from "./show-data-action";

export interface FileActionsProps {
    selectedFiles: FileRecord[];
    onProcessComplete?: () => void;
    onDeleteComplete?: () => void;
    variant?: "header" | "row";
}

export function FileActionMenu({ selectedFiles, onProcessComplete, onDeleteComplete, variant = "header" }: FileActionsProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label="Open file actions">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Open actions</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <ProcessFilesAction selectedFiles={selectedFiles} onProcessComplete={onProcessComplete} />

                <ExportToXmlAction selectedFiles={selectedFiles} />

                <DownloadFilesAction selectedFiles={selectedFiles} />

                <ShowDataAction selectedFiles={selectedFiles} variant={variant} />

                <DropdownMenuSeparator />

                <DeleteFilesAction
                    selectedFiles={selectedFiles}
                    onDeleteComplete={onDeleteComplete}
                    onProcessComplete={onProcessComplete}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
