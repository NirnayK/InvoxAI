"use client";

import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type FileRecord } from "@/lib/files";
import { isTauriRuntime } from "@/lib/database";
import { useFileSelection } from "./use-file-selection";
import { useFileMutations } from "@/lib/hooks/use-files";

interface DeleteFilesActionProps {
    selectedFiles: FileRecord[];
    onDeleteComplete?: () => void;
    onProcessComplete?: () => void;
    processing?: boolean;
}

export function DeleteFilesAction({
    selectedFiles,
    onDeleteComplete,
    onProcessComplete,
    processing = false,
}: DeleteFilesActionProps) {
    const { deleteFiles } = useFileMutations();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteTargets, setDeleteTargets] = useState<FileRecord[]>([]);
    const { hasSelection } = useFileSelection(selectedFiles);

    const handleDeleteClick = () => {
        if (!hasSelection) return;
        setDeleteTargets(selectedFiles);
        setShowDeleteDialog(true);
    };

    const confirmDeleteFiles = async () => {
        if (deleteTargets.length === 0) return;

        try {
            const fileIds = deleteTargets.map((f) => f.id);
            await deleteFiles.mutateAsync(fileIds);
            toast.success(`Deleted ${deleteTargets.length} files.`);
            onDeleteComplete?.();
            onProcessComplete?.(); // Refresh list
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete files.");
        } finally {
            setShowDeleteDialog(false);
            setDeleteTargets([]);
        }
    };

    const cancelDeleteFiles = () => {
        setShowDeleteDialog(false);
        setDeleteTargets([]);
    };

    return (
        <>
            <DropdownMenuItem
                disabled={!hasSelection || processing || !isTauriRuntime()}
                onClick={handleDeleteClick}
                className="text-destructive focus:text-destructive"
            >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
            </DropdownMenuItem>

            {/* Delete Confirmation Dialog */}
            {showDeleteDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="relative w-full max-w-md rounded-lg bg-background p-6 shadow-lg border">
                        <h2 className="text-lg font-semibold">Delete files</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {deleteTargets.length} file{deleteTargets.length === 1 ? "" : "s"} will be permanently removed.
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onClick={cancelDeleteFiles} disabled={deleteFiles.isPending}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={confirmDeleteFiles} disabled={deleteFiles.isPending}>
                                {deleteFiles.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
