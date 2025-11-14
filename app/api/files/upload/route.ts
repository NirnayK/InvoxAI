import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const callbackUrl = process.env.VERCEL_BLOB_CALLBACK_URL;

        return {
          pathname,
          access: "public",
          addRandomSuffix: false,
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          ...(callbackUrl ? { callbackUrl } : {}),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.info(`Upload completed: ${blob.pathname}`);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Blob upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
