import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listXmlFiles, type XmlFileRow } from "@/lib/xml";
import { Loader2 } from "lucide-react";

interface XmlSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (mode: "new" | "append", nameOrId: string | number) => Promise<void>;
    fileCount: number;
}

export function XmlSelectionDialog({
    open,
    onOpenChange,
    onConfirm,
    fileCount,
}: XmlSelectionDialogProps) {
    const [mode, setMode] = useState<"new" | "append">("new");
    const [xmlFiles, setXmlFiles] = useState<XmlFileRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [newXmlName, setNewXmlName] = useState("");
    const [selectedXmlId, setSelectedXmlId] = useState<string>("");

    useEffect(() => {
        if (open) {
            loadXmlFiles();
            setNewXmlName(`Export-${new Date().toISOString().slice(0, 10)}`);
        }
    }, [open]);

    const loadXmlFiles = async () => {
        setLoading(true);
        try {
            const files = await listXmlFiles();
            setXmlFiles(files);
        } catch (error) {
            console.error("Failed to list XML files:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (mode === "new" && !newXmlName.trim()) return;
        if (mode === "append" && !selectedXmlId) return;

        setSubmitting(true);
        try {
            await onConfirm(mode, mode === "new" ? newXmlName : parseInt(selectedXmlId));
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to confirm XML selection:", error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export to Tally XML</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="text-sm text-muted-foreground mb-2">
                        You are about to export {fileCount} invoice{fileCount !== 1 ? "s" : ""} to Tally XML.
                    </div>

                    <div className="space-y-4">
                        {/* Option 1: Create New */}
                        <div className="flex items-start space-x-3 space-y-0">
                            <input
                                type="radio"
                                id="new"
                                value="new"
                                checked={mode === "new"}
                                onChange={() => setMode("new")}
                                className="mt-1 h-4 w-4 border-primary text-primary ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="new" className="font-medium cursor-pointer">
                                    Create new XML file
                                </Label>
                                {mode === "new" && (
                                    <Input
                                        placeholder="Enter XML file name"
                                        value={newXmlName}
                                        onChange={(e) => setNewXmlName(e.target.value)}
                                        className="mt-1.5"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Option 2: Append to Existing */}
                        <div className="flex items-start space-x-3 space-y-0">
                            <input
                                type="radio"
                                id="append"
                                value="append"
                                checked={mode === "append"}
                                onChange={() => setMode("append")}
                                disabled={xmlFiles.length === 0}
                                className="mt-1 h-4 w-4 border-primary text-primary ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="grid gap-1.5 leading-none w-full">
                                <Label
                                    htmlFor="append"
                                    className={`font-medium cursor-pointer ${xmlFiles.length === 0 ? "text-muted-foreground" : ""}`}
                                >
                                    Append to existing XML file
                                    {xmlFiles.length === 0 && " (No existing files)"}
                                </Label>

                                {mode === "append" && (
                                    <div className="mt-1.5">
                                        {loading ? (
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Loading files...
                                            </div>
                                        ) : (
                                            <Select value={selectedXmlId} onValueChange={setSelectedXmlId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select an XML file" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {xmlFiles.map((file) => (
                                                        <SelectItem key={file.id} value={file.id.toString()}>
                                                            {file.xmlName} ({file.fileCount} invoices) - {new Date(file.createdAt).toLocaleDateString()}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Export XML
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
