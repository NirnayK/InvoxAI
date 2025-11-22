"use client";

import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { processFiles } from "@/lib/file-processing";
import type { FileRecord } from "@/lib/files";
import { useFileSelection } from "./use-file-selection";

interface ProcessFilesActionProps {
    selectedFiles: FileRecord[];
    onProcessComplete?: () => void;
}

export function ProcessFilesAction({ selectedFiles, onProcessComplete }: ProcessFilesActionProps) {
    const [processing, setProcessing] = useState(false);
    const { unprocessedFiles } = useFileSelection(selectedFiles);

    const handleProcessClick = async () => {
        if (unprocessedFiles.length === 0) return;

        setProcessing(true);
        try {
            const result = await processFiles(unprocessedFiles);

            const successCount = result.processedFiles;
            const failedCount = result.failedFiles;

            if (successCount > 0) {
                toast.success(`Successfully processed ${successCount} files.`);
            }
            if (failedCount > 0) {
                toast.error(`Failed to process ${failedCount} files.`);
            }

            onProcessComplete?.();
        } catch (error) {
            console.error("Processing error:", error);
            toast.error("An error occurred while processing files.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <DropdownMenuItem disabled={unprocessedFiles.length === 0 || processing} onClick={handleProcessClick}>
            <Play className="mr-2 h-4 w-4" />
            Process
        </DropdownMenuItem>
    );
}
