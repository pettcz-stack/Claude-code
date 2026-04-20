import { useEffect, useState } from "react";
import { api } from "../api";

type Summary = Awaited<ReturnType<typeof api.usageSummary>>;

const FEATURE_LABEL: Record<string, string> = {
  classify: "Klasifikace (haiku)",
  classify_smart: "Klasifikace – eskalace (sonnet)",
  suggest_reply: "Navrhnout odpověď",
};

function usd(n: number): string {
  return `$${n.toFixed(4)}`;
}

export default function Usage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState(30);
  const [threshold, setThreshold] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const s = await api.usageSummary(days);
    setSummary(s);
    setThreshold(s.thresholdUsd === null ? "" : String(s.thresholdUsd));
  };

  useEffect(() => {
    load();
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!summary) return <div className="text-slate-500">Načítám…</div>;

  const maxDay = Math.max(0.0001, ...summary.perDay.map((d) => d.usd));
  const monthVsThreshold =
    summary.thresholdUsd && summary.thresholdUsd > 0 ? (summary.monthUsd / summary.thresholdUsd) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500">Okno</label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 dní</option>
            <option value={30}>30 dní</option>
            <option value={90}>90 dní</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Dnes</div>
          <div className="text-2xl font-bold">{usd(summary.todayUsd)}</div>
        </div>
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Tento měsíc</div>
          <div className="text-2xl font-bold">{usd(summary.monthUsd)}</div>
          {monthVsThreshold !== null && (
            <div className="mt-1 text-xs text-slate-500">
              {Math.round(monthVsThreshold)}% limitu ({usd(summary.thresholdUsd ?? 0)})
              <div className="h-1.5 rounded bg-slate-100 mt-1 overflow-hidden">
                <div
                  className={`h-full ${monthVsThreshold > 100 ? "bg-red-500" : monthVsThreshold > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, monthVsThreshold)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Za {summary.window.days} dní celkem</div>
          <div className="text-2xl font-bold">{usd(summary.totalUsd)}</div>
        </div>
      </div>

      <section className="bg-white rounded shadow-sm p-4">
        <h3 className="font-medium mb-2">Alert při překročení</h3>
        <p className="text-sm text-slate-500 mb-3">
          Když spotřeba v aktuálním měsíci překročí tuto hranici, odešle se jednorázová Slack/email
          notifikace. Prázdné = bez alertu.
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const n = threshold.trim() === "" ? null : Number(threshold);
              if (threshold.trim() !== "" && (!Number.isFinite(n as number) || (n as number) <= 0)) {
                alert("Zadej kladné číslo, nebo nech prázdné.");
                return;
              }
              await api.setUsageAlert(n);
              await load();
            } finally {
              setSaving(false);
            }
          }}
        >
          <div>
            <label className="block text-xs text-slate-500">Hranice (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="border border-slate-300 rounded px-2 py-1 text-sm w-32"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="např. 5"
            />
          </div>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Ukládám…" : "Uložit"}
          </button>
          <button
            type="button"
            className="btn-muted"
            disabled={saving}
            onClick={async () => {
              setThreshold("");
              setSaving(true);
              try {
                await api.setUsageAlert(null);
                await load();
              } finally {
                setSaving(false);
              }
            }}
          >
            Zrušit alert
          </button>
        </form>
      </section>

      <section className="bg-white rounded shadow-sm p-4">
        <h3 className="font-medium mb-3">Spotřeba po dnech</h3>
        {summary.perDay.length === 0 ? (
          <div className="text-sm text-slate-500">Žádná volání v tomto okně.</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {summary.perDay.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-brand-500 rounded-t"
                  style={{ height: `${(d.usd / maxDay) * 100}%` }}
                  title={`${d.day}: ${usd(d.usd)} (${d.calls} volání)`}
                />
                <div className="text-[10px] text-slate-500">{d.day.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded shadow-sm p-4">
        <h3 className="font-medium mb-3">Podle funkce</h3>
        <table className="w-full text-sm">
          <thead className="text-slate-600 text-left">
            <tr>
              <th className="p-2">Funkce</th>
              <th className="p-2">Volání</th>
              <th className="p-2">Input tokens</th>
              <th className="p-2">Output tokens</th>
              <th className="p-2 text-right">Náklad</th>
            </tr>
          </thead>
          <tbody>
            {summary.byFeature.map((f) => (
              <tr key={f.feature} className="border-t border-slate-100">
                <td className="p-2">{FEATURE_LABEL[f.feature] ?? f.feature}</td>
                <td className="p-2">{f.calls}</td>
                <td className="p-2">{f.inputTokens.toLocaleString("cs-CZ")}</td>
                <td className="p-2">{f.outputTokens.toLocaleString("cs-CZ")}</td>
                <td className="p-2 text-right font-mono">{usd(f.usd)}</td>
              </tr>
            ))}
            {summary.byFeature.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500">
                  Žádné volání. Zapni <code>ANTHROPIC_API_KEY</code> a aplikace začne klasifikovat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded shadow-sm p-4">
        <h3 className="font-medium mb-3">Podle modelu</h3>
        <ul className="divide-y text-sm">
          {summary.byModel.map((m) => (
            <li key={m.model} className="py-2 flex justify-between">
              <span className="font-mono">{m.model}</span>
              <span>
                {m.calls} volání · <b>{usd(m.usd)}</b>
              </span>
            </li>
          ))}
          {summary.byModel.length === 0 && <li className="py-2 text-slate-500">—</li>}
        </ul>
      </section>
    </div>
  );
}
