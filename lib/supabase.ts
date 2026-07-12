import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the service role key, which bypasses Row Level
// Security entirely -- this file must never be imported from a "use client"
// component, and the key must never be sent to the browser.
export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
