import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";
import { supabaseServer } from "@/lib/supabase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "done (boolean) required" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { error } = await sb.from("tasks").update({ done: body.done }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const { error } = await sb.from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
