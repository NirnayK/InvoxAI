import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { hash?: string } | null;
  const hash = body?.hash?.toLowerCase();

  if (!hash || !SHA256_HEX_REGEX.test(hash)) {
    return NextResponse.json(
      { error: "hash (sha256 hex) required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("files")
    .select("*")
    .eq("hash_sha256", hash)
    .maybeSingle();

  if (error) {
    console.error("Supabase hash lookup failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({ exists: true, file: data });
}
