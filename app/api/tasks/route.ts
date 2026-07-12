import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";
import { supabaseServer } from "@/lib/supabase";
import { toKey, startOfToday } from "@/lib/streaks";

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const listId = typeof body.list_id === "string" ? body.list_id : "";
  const date = typeof body.date === "string" && body.date ? body.date : toKey(startOfToday());
  const dueDate = typeof body.due_date === "string" && body.due_date ? body.due_date : null;

  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!listId) return NextResponse.json({ error: "list_id required" }, { status: 400 });

  const sb = supabaseServer();
  const { count } = await sb
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId)
    .eq("log_date", date);
  const { data, error } = await sb
    .from("tasks")
    .insert({
      text,
      list_id: listId,
      log_date: date,
      due_date: dueDate,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
