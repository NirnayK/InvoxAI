"use client";

import { X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FileUploadPanel } from "./file-upload-panel";

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

export function FileUploadModal({ open, onOpenChange, onUploadComplete }: FileUploadModalProps) {
  if (!open) return null;

  const handleComplete = () => {
    onUploadComplete?.();
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Upload Files</h2>
            <p className="text-sm text-muted-foreground">
              Upload invoice files (PDF or images) to process them with AI.
            </p>
          </div>

          <FileUploadPanel onComplete={handleComplete} />
        </div>
      </Card>
    </div>
  );
}
