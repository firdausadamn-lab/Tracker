import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const sb = supabaseServer();
  const { count } = await sb.from("habits").select("id", { count: "exact", head: true });
  const { data, error } = await sb
    .from("habits")
    .insert({ name, sort_order: count ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ habit: data });
}
