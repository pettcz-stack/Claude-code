"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { StatCard } from "@/components/StatCard";
import { api, CounterpartStats, Overview } from "@/lib/api";
import { formatRelative } from "@/lib/ui";

export default function StatsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [counterparts, setCounterparts] = useState<CounterpartStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [o, c] = await Promise.all([
          api<Overview>("/stats/overview"),
          api<CounterpartStats[]>("/stats/counterparts"),
        ]);
        setOverview(o);
        setCounterparts(c);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const topDebtors = counterparts
    .filter((c) => c.owes_me > 0)
    .sort((a, b) => b.owes_me - a.owes_me)
    .slice(0, 5);

  const iOwe = counterparts
    .filter((c) => c.i_owe > 0)
    .sort((a, b) => b.i_owe - a.i_owe)
    .slice(0, 5);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Statistiky</h1>
        <p className="mb-6 text-sm text-muted">
          Přehled napříč všemi protějšky – kdo Ti dluží, komu dlužíš Ty, kolik je
          úkolů po termínu.
        </p>

        {err && (
          <div className="mb-4 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        {overview && (
          <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Otevřených úkolů" value={overview.open} />
            <StatCard
              label="Po termínu"
              value={overview.overdue}
              tone={overview.overdue > 0 ? "danger" : "default"}
            />
            <StatCard label="Bez potvrzení" value={overview.awaiting_ack} />
            <StatCard label="Bez ETA" value={overview.awaiting_eta} />
          </section>
        )}

        <section className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted">
              Top 5 – kdo Ti nejvíc dluží
            </h2>
            {topDebtors.length === 0 ? (
              <p className="text-sm text-muted">Nikdo Ti nic nedluží.</p>
            ) : (
              <ul className="space-y-2">
                {topDebtors.map((c) => (
                  <li key={c.email} className="flex items-center gap-3">
                    <Avatar name={c.name} email={c.email} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{c.name || c.email}</div>
                      <div className="truncate text-xs text-muted">{c.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">{c.owes_me}</div>
                      {c.overdue > 0 && (
                        <div className="text-xs text-rose-300">{c.overdue} po termínu</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted">
              Top 5 – komu dlužíš Ty
            </h2>
            {iOwe.length === 0 ? (
              <p className="text-sm text-muted">Nikomu nic nedlužíš. ✓</p>
            ) : (
              <ul className="space-y-2">
                {iOwe.map((c) => (
                  <li key={c.email} className="flex items-center gap-3">
                    <Avatar name={c.name} email={c.email} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{c.name || c.email}</div>
                      <div className="truncate text-xs text-muted">{c.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold tabular-nums">{c.i_owe}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted">
            Všichni protějšci ({counterparts.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-line bg-panel">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg/40 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Protějšek</th>
                  <th className="px-4 py-2 text-right">Dluží mi</th>
                  <th className="px-4 py-2 text-right">Dlužím</th>
                  <th className="px-4 py-2 text-right">Po termínu</th>
                  <th className="px-4 py-2 text-right">Hotových</th>
                  <th className="px-4 py-2 text-right">Poslední aktivita</th>
                </tr>
              </thead>
              <tbody>
                {counterparts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      Žádné úkoly k zobrazení.
                    </td>
                  </tr>
                )}
                {counterparts.map((c) => (
                  <tr key={c.email} className="border-b border-line/60 last:border-0 hover:bg-line/30">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={c.name} email={c.email} size={28} />
                        <div className="min-w-0">
                          <div className="truncate">{c.name || c.email}</div>
                          {c.name && (
                            <div className="truncate text-xs text-muted">{c.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.owes_me}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.i_owe}</td>
                    <td className={"px-4 py-2 text-right tabular-nums " + (c.overdue > 0 ? "text-rose-300" : "text-muted")}>
                      {c.overdue}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{c.done}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted">
                      {formatRelative(c.last_activity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
