"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) throw new Error("Špatné heslo");
      window.location.href = "/";
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
      {/* Pozadí glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl border border-line bg-panel/90 p-8 shadow-2xl backdrop-blur"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-emerald-400 shadow-lg shadow-brand/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b0d10" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Efektivní manažer</h1>
          <p className="mt-1 text-sm text-muted">Tracking úkolů z Tvého emailu.</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 outline-none focus:border-brand"
            placeholder="Master heslo"
          />
          {err && <p className="text-sm text-rose-300">{err}</p>}
          <button
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-brand to-emerald-400 py-2.5 font-semibold text-bg shadow-lg shadow-brand/20 disabled:opacity-50"
          >
            {loading ? "Přihlašuji…" : "Přihlásit se"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Heslo nastavuješ přes <code>EFEKTIVNI_MASTER_PASSWORD</code> v .env.
        </p>
      </form>
    </main>
  );
}
