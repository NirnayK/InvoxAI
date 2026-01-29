export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".tif",
  ".tiff",
  ".bmp",
  ".heic",
] as const;

export const INVOICE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["seller name", "invoce number", "date", "seller address", "items"],
  properties: {
    // Parties & identifiers
    "seller name": {
      type: ["string", "null"],
      description: "Legal name of the seller as written on the invoice.",
    },
    "seller address": {
      type: ["string", "null"],
      description: "Seller address block as printed.",
    },
    "seller gstin": {
      type: ["string", "null"],
      description: "Seller GSTIN as printed on the invoice.",
    },
    "buyer name": {
      type: ["string", "null"],
      description: "Buyer name as printed (or our legal entity name).",
    },
    "buyer address": {
      type: ["string", "null"],
      description: "Buyer address block as printed.",
    },
    "buyer gstin": {
      type: ["string", "null"],
      description: "Buyer GSTIN as printed on the invoice.",
    },

    // Numbers & dates
    "invoce number": {
      type: ["string", "null"],
      description: "Invoice number exactly as printed (typos preserved on purpose).",
    },
    "voucher number": {
      type: ["string", "null"],
      description:
        "Internal voucher number (Tally VOUCHERNUMBER). Can be left null if generated later.",
    },
    "reference number": {
      type: ["string", "null"],
      description:
        "Supplier's invoice number as used in Tally REFERENCE (often different from internal voucher number).",
    },
    date: {
      type: ["string", "null"],
      description:
        "Invoice/voucher date for accounting purposes, prefer ISO format YYYY-MM-DD; if not parseable, return raw string.",
    },
    "reference date": {
      type: ["string", "null"],
      description:
        "Supplier's invoice date (Tally REFERENCEDATE). Prefer ISO format YYYY-MM-DD; if not parseable, return raw string.",
    },

    // Classification
    "voucher type": {
      type: ["string", "null"],
      description:
        'High-level voucher type, e.g. "Purchase", "Sales". Used to pick Tally VOUCHERTYPENAME/VCHTYPE.',
    },
    "place of supply": {
      type: ["string", "null"],
      description: "Place of supply / state name as printed (e.g. Maharashtra).",
    },

    // Totals (optional but useful for sanity checks)
    subtotal: {
      anyOf: [{ type: "number" }, { type: "null" }],
      description: "Invoice subtotal before tax (sum of line item base amounts), if available.",
    },
    "tax total": {
      anyOf: [{ type: "number" }, { type: "null" }],
      description: "Total tax on the invoice (sum of all GST components), if available.",
    },
    "grand total": {
      anyOf: [{ type: "number" }, { type: "null" }],
      description:
        "Grand total payable on the invoice as printed (party ledger amount), if available.",
    },

    // Line items
    items: {
      type: "array",
      description: "Line items detected on the invoice.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["HSN/SAC"],
        properties: {
          description: {
            type: ["string", "null"],
            description: "Item description or full text as printed on that line.",
          },
          name: {
            type: ["string", "null"],
            description: "Short item name (can be mapped to Tally STOCKITEMNAME if desired).",
          },
          "HSN/SAC": {
            type: ["string", "null"],
            description: "HSN/SAC code for the line item, as printed.",
          },
          quantity: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "Quantity billed for this line.",
          },
          unit: {
            type: ["string", "null"],
            description: 'Unit of measure, e.g. "Pc", "Nos", "Kg" as printed or as inferred.',
          },
          rate: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "Per-unit rate for this line (excluding tax if possible).",
          },
          amount: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description:
              "Line amount (normally quantity × rate). Prefer base amount exclusive of tax.",
          },
          cgst: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "CGST amount for this line, if separately available.",
          },
          sgst: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "SGST amount for this line, if separately available.",
          },
          cgst_rate: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "CGST rate in percent for this line (e.g. 9 for 9% CGST).",
          },
          sgst_rate: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "SGST rate in percent for this line (e.g. 9 for 9% SGST).",
          },
        },
      },
    },
  },
} as const;

export const SYSTEM_INSTRUCTION = [
  "You are an invoice parser. Read the provided document (PDF or image) and extract ONLY the requested fields.",

  "Rules:",
  "1) Your output must strictly conform to the INVOICE_JSON_SCHEMA provided by the client.",
  "2) Extract all fields defined in the schema when they are clearly present. If a field is missing or cannot be confidently determined, use null (or an empty array for items).",
  "3) Do NOT invent, guess, or normalize values beyond what is printed. Never hallucinate GSTINs, addresses, dates, or totals.",
  "4) Strip currency symbols and thousand separators from numeric amounts; return numeric fields as plain numbers when present.",
  "5) For GST-related fields (cgst, sgst, gst_rate, tax total):",
  "   - Use only values that are explicitly present or clearly implied on the invoice.",
  "   - If CGST/SGST or GST rate are not printed or cannot be reliably inferred, set them to null.",
  "   - Do NOT compute or back-calculate missing taxes or totals.",
  "6) For totals (subtotal, tax total, grand total): if printed, read them exactly; if not printed, set them to null. Do NOT recompute them from line items.",
  "7) Prefer ISO date format (YYYY-MM-DD) if you can reliably parse the date; otherwise return the date exactly as printed.",
  "8) Preserve original spelling and case for all text fields (e.g., seller name, buyer name, addresses, voucher type).",
  "9) For quantity, rate, and amount, ignore units and currency symbols in the numeric fields but keep units in the dedicated unit field where applicable.",
  "10) For voucher number, reference number, and reference date, only fill them if they are explicitly present or clearly labeled on the document; otherwise use null.",
  "11) The items array must always be present (at least an empty array). Each item must follow the item schema exactly.",
  "12) Return ONLY a single valid JSON object as the response, with no extra text before or after.",
].join("\n");

export const USER_PROMPT = `
Given a single invoice document (PDF or image), extract a JSON object that strictly matches INVOICE_JSON_SCHEMA.

Top-level keys include:
- "seller name", "seller address", "seller gstin",
- "buyer name", "buyer address", "buyer gstin",
- "invoce number", "voucher number", "reference number",
- "date", "reference date",
- "voucher type", "place of supply",
- "subtotal", "tax total", "grand total",
- and "items".

Each element of "items" must be an object with keys:
- "description", "name", "HSN/SAC",
- "quantity", "unit",
- "rate", "amount",
- "cgst", "sgst",
- "gst_rate".

Follow all rules in SYSTEM_INSTRUCTION: do not invent values, use null when fields are missing, and return ONLY the JSON object with no additional text.
`.trim();

export const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
};

export const GENERATION_CONFIG = {
  systemInstruction: SYSTEM_INSTRUCTION,
  responseMimeType: "application/json",
  responseJsonSchema: INVOICE_JSON_SCHEMA,
  temperature: 0,
};

export const BATCH_GENERATION_CONFIG = {
  system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  response_mime_type: "application/json",
  response_json_schema: INVOICE_JSON_SCHEMA,
  temperature: 0,
};
