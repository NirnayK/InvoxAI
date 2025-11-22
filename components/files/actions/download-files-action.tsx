"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import type { FileRecord } from "@/lib/files";
import { isTauriRuntime } from "@/lib/database";
import { createLogger } from "@/lib/logger";
import { useFileSelection } from "./use-file-selection";

interface DownloadFilesActionProps {
    selectedFiles: FileRecord[];
}

const logger = createLogger("DownloadFilesAction");

export function DownloadFilesAction({ selectedFiles }: DownloadFilesActionProps) {
    const { hasSelection } = useFileSelection(selectedFiles);

    const handleDownloadFiles = async () => {
        if (!hasSelection) return;

        try {
            if (isTauriRuntime()) {
                const tauriOpen = (window as typeof window & { __TAURI__?: { shell?: { open?: (path: string) => Promise<void> } } }).__TAURI__?.shell?.open;
                if (tauriOpen) {
                    for (const file of selectedFiles) {
                        await tauriOpen(file.storedPath);
                    }
                }
            }
        } catch (error) {
            logger.error("File download failed", { error });
        }
    };

    return (
        <DropdownMenuItem disabled={!hasSelection} onClick={handleDownloadFiles}>
            <Download className="mr-2 h-4 w-4" />
            Download file
        </DropdownMenuItem>
    );
}
