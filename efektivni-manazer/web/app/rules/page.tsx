"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { IconAlert, IconBell, IconInbox, IconRules } from "@/components/Icon";
import { api, Rule } from "@/lib/api";

const LEVEL_ICON: Record<string, React.ReactNode> = {
  info: <IconInbox size={14} />,
  warning: <IconBell size={14} />,
  urgent: <IconAlert size={14} />,
};
const LEVEL_COLOR: Record<string, string> = {
  info: "text-sky-300",
  warning: "text-amber-300",
  urgent: "text-rose-300",
};

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
  useEffect(() => {
    load();
  }, []);

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
      <main className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-300">
            <IconRules size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">SLA pravidla</h1>
            <p className="text-sm text-muted">
              Worker pravidla vyhodnocuje pravidelně. Když podmínka platí a není
              cooldown, vznikne notifikace v Dashboardu.
            </p>
          </div>
        </div>

        {loading && <p className="text-muted">Načítám…</p>}
        {err && <p className="text-rose-300">{err}</p>}

        <ul className="space-y-3">
          {rules.map((r) => {
            const level = (r.action?.level || "info") as string;
            const cooldown = r.action?.cooldown_hours;
            return (
              <li
                key={r.id}
                className={
                  "rounded-xl border bg-panel transition " +
                  (r.enabled ? "border-line" : "border-line/50 opacity-60")
                }
              >
                <div className="flex items-start gap-4 p-4">
                  <div className={`mt-1 ${LEVEL_COLOR[level]}`}>{LEVEL_ICON[level]}</div>
                  <div className="flex-1">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-muted">{r.description}</div>
                    {r.action?.message && (
                      <div className="mt-2 inline-block rounded bg-line px-2 py-0.5 text-xs text-ink">
                        „{r.action.message}"
                      </div>
                    )}
                    {cooldown && (
                      <div className="mt-1 text-xs text-muted">
                        cooldown {cooldown} h
                      </div>
                    )}
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                    <span className="text-muted">
                      {r.enabled ? "Aktivní" : "Vypnuto"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(r)}
                      className={
                        "relative h-6 w-11 rounded-full transition " +
                        (r.enabled ? "bg-brand" : "bg-line")
                      }
                    >
                      <span
                        className={
                          "absolute top-0.5 h-5 w-5 rounded-full bg-bg transition " +
                          (r.enabled ? "left-[22px]" : "left-0.5")
                        }
                      />
                    </button>
                  </label>
                </div>
                <details className="border-t border-line/60 px-4 py-2 text-xs text-muted">
                  <summary className="cursor-pointer">Detail (JSON)</summary>
                  <pre className="mt-2 overflow-auto rounded bg-bg p-3">
{JSON.stringify({ condition: r.condition, action: r.action }, null, 2)}
                  </pre>
                </details>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-muted">
          Editor podmínek/akcí v UI dodáme v další iteraci. Zatím lze pravidla
          spravovat přes API <code>/rules</code>.
        </p>
      </main>
    </>
  );
}
