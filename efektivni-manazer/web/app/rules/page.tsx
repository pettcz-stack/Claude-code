"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { api, Rule } from "@/lib/api";

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setRules(await api<Rule[]>("/rules"));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggle(r: Rule) {
    const updated = await api<Rule>(`/rules/${r.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...r, enabled: !r.enabled }),
    });
    setRules((cur) => cur.map((x) => (x.id === r.id ? updated : x)));
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-semibold">SLA pravidla</h1>
        <p className="mb-6 text-sm text-muted">
          Pravidla se vyhodnocují ve workeru každých {" "}
          <code>SLA_TICK_INTERVAL</code> sekund. Při splnění podmínky vznikne
          notifikace v dashboardu.
        </p>
        {loading && <p className="text-muted">Načítám…</p>}
        {err && <p className="text-danger">{err}</p>}
        <ul className="space-y-3">
          {rules.map((r) => (
            <li key={r.id} className="rounded border border-line bg-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-muted">{r.description}</div>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => toggle(r)}
                  />
                  {r.enabled ? "Aktivní" : "Vypnuto"}
                </label>
              </div>
              <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer">Detail (JSON)</summary>
                <pre className="mt-2 overflow-auto rounded bg-bg p-3">
{JSON.stringify({ condition: r.condition, action: r.action }, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">
          Editor podmínek/akcí v UI dodáme v další iteraci. Zatím pravidla
          spravujeme přes API <code>/rules</code>.
        </p>
      </main>
    </>
  );
}
