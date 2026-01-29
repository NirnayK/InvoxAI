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

export type InvoiceData = {
  "seller name": string | null;
  "seller address": string | null;
  "seller gstin": string | null;
  "buyer name": string | null;
  "buyer address": string | null;
  "buyer gstin": string | null;
  "invoce number": string | null;
  "voucher number": string | null;
  "reference number": string | null;
  date: string | null;
  "reference date": string | null;
  "voucher type": string | null;
  "place of supply": string | null;
  subtotal: number | null;
  "tax total": number | null;
  "grand total": number | null;
  items: InvoiceItem[];
};
