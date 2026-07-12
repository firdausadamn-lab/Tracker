import { NextRequest, NextResponse } from "next/server";
import { checkPasscode, makeSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  if (!passcode || !checkPasscode(passcode)) {
    return NextResponse.json({ ok: false, error: "Wrong passphrase." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
