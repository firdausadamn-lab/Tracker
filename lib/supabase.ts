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
    // Next.js patches global fetch and caches GET responses in a persistent
    // on-disk Data Cache. That cache once stored empty results (from before any
    // habits existed) and kept serving them to the cacheable "/" route, so the
    // public page read 0 rows while the cookie-gated (never-cached) admin page
    // read live data. A server client backed by the service role key must always
    // reflect live state, so opt every request out of the Data Cache.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
