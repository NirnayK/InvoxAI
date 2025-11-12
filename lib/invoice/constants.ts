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
    "seller name": {
      type: ["string", "null"],
      description: "Legal name of the seller as written on the invoice.",
    },
    "invoce number": {
      type: ["string", "null"],
      description: "Invoice number exactly as printed (typos preserved on purpose).",
    },
    date: {
      type: ["string", "null"],
      description:
        "Invoice date, prefer ISO format YYYY-MM-DD; if not parseable, return raw string.",
    },
    "seller address": {
      type: ["string", "null"],
      description: "Seller address block as printed.",
    },
    items: {
      type: "array",
      description: "Line items detected on the invoice.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["HSN/SAC"],
        properties: {
          "HSN/SAC": { type: ["string", "null"] },
          quantity: { anyOf: [{ type: "number" }, { type: "null" }] },
          rate: { anyOf: [{ type: "number" }, { type: "null" }] },
          amount: { anyOf: [{ type: "number" }, { type: "null" }] },
          csgst: { anyOf: [{ type: "number" }, { type: "null" }] },
          sgst: { anyOf: [{ type: "number" }, { type: "null" }] },
        },
      },
    },
  },
} as const;

export const SYSTEM_INSTRUCTION = [
  "You are an invoice parser. Read the provided document (PDF or image) and extract ONLY the requested fields.",
  "Rules:",
  "1) Output must strictly match the provided JSON schema.",
  "2) Do not invent values. If a field is missing, use null (or empty array for items).",
  "3) Strip currency symbols; return numeric fields as plain numbers when present.",
  "4) If both CGST and SGST are absent, set them to 0 or null; do NOT compute missing taxes.",
  "5) Prefer ISO date (YYYY-MM-DD) if possible; otherwise return whatever is printed.",
  "6) Preserve original spelling/case for text fields (e.g., seller name).",
].join("\n");

export const USER_PROMPT =
  "Extract the JSON with keys: 'seller name', 'invoce number', 'date', 'seller address', and 'items' (where each item has 'HSN/SAC', 'quantity', 'rate', 'amount', 'csgst', 'sgst'). Return ONLY JSON.";

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
