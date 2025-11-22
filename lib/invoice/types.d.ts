export type InvoiceItem = {
  description: string | null;
  name: string | null;
  "HSN/SAC": string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
  cgst: number | null;
  sgst: number | null;
  cgst_rate: number | null;
  sgst_rate: number | null;
};

export type InvoiceExtractionResult = {
  // Parties & identifiers
  "seller name": string | null;
  "seller address": string | null;
  "seller gstin": string | null;
  "buyer name": string | null;
  "buyer address": string | null;
  "buyer gstin": string | null;

  // Numbers & dates
  "invoce number": string | null;
  "voucher number"?: string | null;
  "reference number"?: string | null;
  date: string | null;
  "reference date"?: string | null;

  // Classification
  "voucher type"?: string | null;
  "place of supply"?: string | null;

  // Totals
  subtotal?: number | null;
  "tax total"?: number | null;
  "grand total"?: number | null;

  // Line items
  items?: InvoiceItem[];
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
