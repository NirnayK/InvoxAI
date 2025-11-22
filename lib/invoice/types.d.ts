export type InvoiceItem = {
  "HSN/SAC": string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  csgst: number | null;
  sgst: number | null;
};

export type InvoiceExtractionResult = {
  "seller name": string | null;
  "invoce number": string | null;
  date: string | null;
  "seller address": string | null;
  items: InvoiceItem[];
};

export type ExtractionPayload = InvoiceExtractionResult | { _raw: string };

export interface BatchExtractionResult {
  fileId: string;
  fileName: string;
  result: ExtractionPayload;
  error?: string;
}

export interface ProcessingError {
  fileId: string;
  fileName: string;
  error: string;
  statusCode?: number;
}

export interface InvoiceFileInput {
  file: string | Blob;
  mimeType?: string;
  displayName?: string;
}

export interface NormalizedFile {
  source: string | Blob;
  mimeType: string;
  displayName?: string;
  label: string;
}

export interface UploadedFileRef {
  label: string;
  fileName: string;
  fileUri?: string;
  mimeType: string;
}
