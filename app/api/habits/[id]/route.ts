import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";
import { supabaseServer } from "@/lib/supabase";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const { error } = await sb.from("habits").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
