import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";
import { supabaseServer } from "@/lib/supabase";
import { syncUnlocks } from "@/lib/progress";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === "string" ? body.date : null;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const sb = supabaseServer();
  const { data: existing } = await sb
    .from("habit_logs")
    .select("habit_id")
    .eq("habit_id", params.id)
    .eq("log_date", date)
    .maybeSingle();

  let done: boolean;
  if (existing) {
    const { error } = await sb
      .from("habit_logs")
      .delete()
      .eq("habit_id", params.id)
      .eq("log_date", date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    done = false;
  } else {
    const { error } = await sb
      .from("habit_logs")
      .insert({ habit_id: params.id, log_date: date, done: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    done = true;
  }

  // Recompute achievements after every change. Best-effort: a failure here
  // must not fail the toggle itself (unlocks re-sync on the next change).
  try {
    await syncUnlocks(sb);
  } catch {
    /* ignore */
  }

  return NextResponse.json({ done });
}
