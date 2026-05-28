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
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-panel p-8"
      >
        <h1 className="text-xl font-semibold">Efektivní manažer</h1>
        <p className="text-sm text-muted">
          Zadej master heslo (z <code>EFEKTIVNI_MASTER_PASSWORD</code>).
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full rounded border border-line bg-bg px-3 py-2 outline-none focus:border-brand"
          placeholder="Heslo"
        />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-brand py-2 font-medium text-bg disabled:opacity-50"
        >
          {loading ? "Přihlašuji…" : "Přihlásit"}
        </button>
      </form>
    </main>
  );
}
