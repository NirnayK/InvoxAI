import type { InvoiceExtractionResult } from "../invoice/helpers";
import type { InvoiceData } from "./types";

export class InvoiceDataMapper {
  convertToInvoiceData(result: InvoiceExtractionResult): InvoiceData {
    return {
      "seller name": result["seller name"] ?? null,
      "seller address": result["seller address"] ?? null,
      "seller gstin": result["seller gstin"] ?? null,
      "buyer name": result["buyer name"] ?? null,
      "buyer address": result["buyer address"] ?? null,
      "buyer gstin": result["buyer gstin"] ?? null,
      "invoce number": result["invoce number"] ?? null,
      "voucher number": result["voucher number"] ?? null,
      "reference number": result["reference number"] ?? null,
      date: result.date ?? null,
      "reference date": result["reference date"] ?? null,
      "voucher type": result["voucher type"] ?? null,
      "place of supply": result["place of supply"] ?? null,
      subtotal: result.subtotal ?? null,
      "tax total": result["tax total"] ?? null,
      "grand total": result["grand total"] ?? null,
      items: result.items ?? [],
    };
  }
}
