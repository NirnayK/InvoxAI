"use client";

import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import type { FileRecord } from "@/lib/files";

interface ShowDataActionProps {
    selectedFiles: FileRecord[];
    variant?: "header" | "row";
}

export function ShowDataAction({ selectedFiles, variant = "header" }: ShowDataActionProps) {
    const [showDataDialog, setShowDataDialog] = useState(false);
    const [dataPreview, setDataPreview] = useState("");

    const canShowData = variant === "row" && selectedFiles.length === 1;

    const handleShowData = () => {
        if (!canShowData) return;
        const target = selectedFiles[0];
        if (!target) return;

        const content = target.parsedDetails ?? "No extracted data yet.";
        try {
            const parsed = JSON.parse(content);
            setDataPreview(JSON.stringify(parsed, null, 2));
        } catch {
            setDataPreview(content);
        }
        setShowDataDialog(true);
    };

    if (variant !== "row") {
        return null;
    }

    return (
        <>
            <DropdownMenuItem onClick={handleShowData}>
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Show data
            </DropdownMenuItem>

            {/* Data Preview Dialog */}
            {showDataDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="relative w-full max-w-2xl rounded-lg bg-background p-6 shadow-lg border max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Extracted Data</h2>
                            <Button variant="ghost" size="sm" onClick={() => setShowDataDialog(false)}>Close</Button>
                        </div>
                        <pre className="flex-1 overflow-auto rounded-md bg-muted p-4 text-xs text-muted-foreground whitespace-pre-wrap">
                            {dataPreview}
                        </pre>
                    </div>
                </div>
            )}
        </>
    );
}
