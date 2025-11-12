import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import crypto from "crypto";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const runtime = "nodejs";

const DUPLICATE_ERROR = "DUPLICATE_HASH";
const INVALID_HASH_ERROR = "INVALID_HASH";
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

type ClientPayload = {
  id?: string;
  hash?: string;
  originalName?: string;
  ownerId?: string | null;
};

const parsePayload = (payload?: string | null): ClientPayload => {
  if (!payload) return {};
  try {
    return JSON.parse(payload) as ClientPayload;
  } catch {
    return {};
  }
};

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);

        if (payload.hash) {
          const normalizedHash = payload.hash.toLowerCase();

          if (!SHA256_HEX_REGEX.test(normalizedHash)) {
            throw new Error(INVALID_HASH_ERROR);
          }

          const { data, error } = await supabaseAdmin
            .from("files")
            .select("id")
            .eq("hash_sha256", normalizedHash)
            .maybeSingle();

          if (error) {
            console.error("Supabase hash check error:", error);
            throw new Error("HASH_LOOKUP_FAILED");
          }

          if (data) {
            throw new Error(DUPLICATE_ERROR);
          }
        }

        const callbackUrl = process.env.VERCEL_BLOB_CALLBACK_URL;

        return {
          pathname,
          access: "public",
          addRandomSuffix: false,
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          ...(callbackUrl ? { callbackUrl } : {}),
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = parsePayload(tokenPayload);
          const response = await fetch(blob.url);

          if (!response.ok) {
            console.error("Failed to fetch blob for hashing", response.statusText);
            return;
          }

          const fileBuffer = Buffer.from(await response.arrayBuffer());
          const serverHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

          const record = {
            id: payload.id ?? crypto.randomUUID(),
            owner: payload.ownerId ?? null,
            hash_sha256: serverHash,
            path: blob.pathname,
            url: blob.url,
            size_bytes: fileBuffer.byteLength,
            mime_type: blob.contentType,
            original_name: payload.originalName ?? null,
          };

          const { error } = await supabaseAdmin.from("files").insert(record).single();

          if (error) {
            const pgError = error as { code?: string };
            if (pgError.code !== "23505") {
              console.error("Supabase insert error:", error);
            }
          }
        } catch (callbackError) {
          console.error("Blob completion handler failed", callbackError);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === DUPLICATE_ERROR) {
        return NextResponse.json({ error: "duplicate_hash" }, { status: 409 });
      }
      if (error.message === INVALID_HASH_ERROR) {
        return NextResponse.json({ error: "invalid_hash" }, { status: 400 });
      }
    }

    console.error("Blob upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
