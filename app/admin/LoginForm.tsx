"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5">
      <div className="w-full rounded-[10px] border border-border bg-elev p-7">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-inkfaint">
          Proof: Admin
        </div>
        <h1 className="mb-5 font-display text-[22px] font-semibold text-ink">
          Enter passphrase
        </h1>
        <form onSubmit={submit}>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            className="w-full rounded-[8px] border border-border bg-elev2 px-3.5 py-2.5 text-[14.5px] text-ink outline-none focus:border-accent"
            placeholder="Passphrase"
          />
          {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-[8px] bg-accent px-4 py-2.5 text-[14.5px] font-medium text-accentink transition active:translate-y-[1px] active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
