import { useEffect, useState } from "react";
import { api } from "../api";

type Stats = Awaited<ReturnType<typeof api.statsOverview>>;

const CATEGORY_COLOR: Record<string, string> = {
  brand_attack: "bg-red-400",
  vulgarity: "bg-orange-400",
  spam: "bg-yellow-400",
  legitimate_criticism: "bg-blue-400",
  neutral: "bg-slate-400",
  positive: "bg-emerald-400",
};

export default function Stats() {
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.statsOverview(days).then(setStats);
  }, [days]);

  if (!stats) return <div className="text-slate-500">Načítám…</div>;

  const maxPerDay = Math.max(1, ...stats.perDay.map((d) => d.count));
  const total = stats.byCategory.reduce((s, c) => s + c.count, 0) || 1;

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
            <option value={1}>1 den</option>
            <option value={7}>7 dní</option>
            <option value={30}>30 dní</option>
            <option value={90}>90 dní</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Komentáře</div>
          <div className="text-2xl font-bold">{stats.totalComments}</div>
        </div>
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Provedené akce</div>
          <div className="text-2xl font-bold">{stats.totalActions}</div>
        </div>
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Průměrný čas od detekce k akci</div>
          <div className="text-2xl font-bold">
            {stats.avgResponseSeconds < 60
              ? `${stats.avgResponseSeconds} s`
              : `${Math.round(stats.avgResponseSeconds / 60)} min`}
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm p-4">
        <h3 className="font-medium mb-3">Rozložení kategorií</h3>
        <div className="flex h-6 rounded overflow-hidden">
          {stats.byCategory.map((c) => (
            <div
              key={c.category}
              className={CATEGORY_COLOR[c.category] ?? "bg-slate-300"}
              style={{ width: `${(c.count / total) * 100}%` }}
              title={`${c.category}: ${c.count}`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {stats.byCategory.map((c) => (
            <div key={c.category} className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded ${CATEGORY_COLOR[c.category] ?? "bg-slate-300"}`} />
              <span>
                {c.category}: <b>{c.count}</b>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded shadow-sm p-4">
        <h3 className="font-medium mb-3">Komentáře po dnech</h3>
        <div className="flex items-end gap-1 h-32">
          {stats.perDay.map((d) => {
            const day = d.day ?? "—";
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-brand-500 rounded-t"
                  style={{ height: `${(d.count / maxPerDay) * 100}%` }}
                  title={`${day}: ${d.count}`}
                />
                <div className="text-[10px] text-slate-500">{day.length > 5 ? day.slice(5) : day}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded shadow-sm p-4">
        <h3 className="font-medium mb-3">Top autoři negativních komentářů</h3>
        <ul className="divide-y">
          {stats.topNegativeAuthors.map((a) => (
            <li key={a.authorName} className="py-2 flex justify-between text-sm">
              <span>{a.authorName}</span>
              <b>{a.count}</b>
            </li>
          ))}
          {stats.topNegativeAuthors.length === 0 && <li className="text-slate-500 text-sm">Žádná data</li>}
        </ul>
      </div>
    </div>
  );
}
