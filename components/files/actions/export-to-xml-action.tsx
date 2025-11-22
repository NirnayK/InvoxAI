"use client";

import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import type { FileRecord } from "@/lib/files";
import { createXmlForFiles, appendXmlFile, generateXmlFile } from "@/lib/xml";
import { generateTallyXml, convertToInvoiceData } from "@/lib/xml-generator";
import { XmlSelectionDialog } from "../xml-selection-dialog";
import { save } from "@tauri-apps/plugin-dialog";
import { saveFile } from "@/lib/filesystem";
import { useFileSelection } from "./use-file-selection";

interface ExportToXmlActionProps {
    selectedFiles: FileRecord[];
}

export function ExportToXmlAction({ selectedFiles }: ExportToXmlActionProps) {
    const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
    const [generatingXml, setGeneratingXml] = useState(false);
    const { processedFiles } = useFileSelection(selectedFiles);

    const handleXmlClick = () => {
        // Validation: Ensure all selected files are processed
        const unprocessed = selectedFiles.filter((f) => f.status !== "Processed");
        if (unprocessed.length > 0) {
            toast.error(`Cannot export to XML. ${unprocessed.length} files are not processed yet.`);
            return;
        }
        setXmlDialogOpen(true);
    };

    const handleXmlConfirm = async (mode: "new" | "append", nameOrId: string | number) => {
        setGeneratingXml(true);
        try {
            const fileIds = selectedFiles.map((f) => f.id);
            let xmlId: number;

            if (mode === "new") {
                xmlId = await createXmlForFiles(fileIds, nameOrId as string);
            } else {
                xmlId = nameOrId as number;
                await appendXmlFile(xmlId, fileIds);
            }

            // Generate XML content
            const result = await generateXmlFile(xmlId);

            // Parse JSON lines into InvoiceData objects
            const invoices = result.content
                .split('\n')
                .filter((line: string) => line.trim().length > 0)
                .map((line: string) => {
                    try {
                        return convertToInvoiceData(JSON.parse(line));
                    } catch (e) {
                        console.error("Failed to parse invoice JSON:", e);
                        return null;
                    }
                })
                .filter((item): item is NonNullable<ReturnType<typeof convertToInvoiceData>> => item !== null);

            if (invoices.length === 0) {
                toast.error("No valid invoice data found to export.");
                return;
            }

            const xmlContent = generateTallyXml(invoices);

            // Save to file
            const savePath = await save({
                filters: [{
                    name: 'XML',
                    extensions: ['xml']
                }],
                defaultPath: `invox-export-${new Date().toISOString().slice(0, 10)}.xml`
            });

            if (savePath) {
                await saveFile(savePath, xmlContent);
                toast.success(`Successfully exported to XML: ${savePath}`);
            }

        } catch (error) {
            console.error("XML export error:", error);
            toast.error("Failed to export XML.");
        } finally {
            setGeneratingXml(false);
        }
    };

    return (
        <>
            <DropdownMenuItem disabled={processedFiles.length === 0 || generatingXml} onClick={handleXmlClick}>
                <FileText className="mr-2 h-4 w-4" />
                Save to XML
            </DropdownMenuItem>

            <XmlSelectionDialog
                open={xmlDialogOpen}
                onOpenChange={setXmlDialogOpen}
                onConfirm={handleXmlConfirm}
                fileCount={selectedFiles.length}
            />
        </>
    );
}
