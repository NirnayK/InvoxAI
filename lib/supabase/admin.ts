import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase admin env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE.",
  );
}

// Service role client for server-only access (RLS bypass, inserts, etc.)
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

