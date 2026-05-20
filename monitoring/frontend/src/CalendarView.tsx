import { useEffect, useState } from 'react';
import { api, type HourlyRow, type User } from './api.js';
import { startOfLocalDay, minutesToHm, localHourOf } from './util.js';

type Props = { user: User; day: Date };

export function CalendarView({ user, day }: Props) {
  const [rows, setRows] = useState<HourlyRow[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    const from = startOfLocalDay(day);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    setLoading(true);
    setError(null);
    api
      .hourly(user.id, from.toISOString(), to.toISOString())
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [user.id, day]);

  const byHour = new Map<number, HourlyRow>();
  for (const r of rows) byHour.set(localHourOf(r.hourStart), r);

  const totalActive = rows.reduce((s, r) => s + r.activeMinutes, 0);
  const totalIdle = rows.reduce((s, r) => s + r.idleMinutes, 0);

  return (
    <div>
      <div className="mb-3 flex gap-6 text-sm text-gray-600">
        <span>
          Aktivní celkem: <strong className="text-emerald-700">{minutesToHm(totalActive)}</strong>
        </span>
        <span>
          Nečinnost: <strong className="text-gray-700">{minutesToHm(totalIdle)}</strong>
        </span>
        {loading && <span className="text-blue-600">Načítám…</span>}
        {error && <span className="text-red-600">Chyba: {error}</span>}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="w-16 px-3 py-2">Hodina</th>
              <th className="px-3 py-2">Aktivita (z 60 min)</th>
              <th className="w-40 px-3 py-2">Top aplikace</th>
              <th className="w-28 px-3 py-2 text-right">Úhozy/min</th>
              <th className="w-28 px-3 py-2 text-right">Úhozy</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 24 }, (_, h) => {
              const r = byHour.get(h);
              const active = r?.activeMinutes ?? 0;
              const idle = r?.idleMinutes ?? 0;
              const locked = r?.lockedMinutes ?? 0;
              const denom = Math.max(active + idle + locked, 60);
              const pct = (v: number) => `${(v / denom) * 100}%`;
              return (
                <tr key={h} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-500">{String(h).padStart(2, '0')}:00</td>
                  <td className="px-3 py-2">
                    <div className="flex h-4 w-full overflow-hidden rounded bg-gray-100" title={
                      r
                        ? `Aktivní ${minutesToHm(active)} · Nečinnost ${minutesToHm(idle)} · Zamčeno ${minutesToHm(locked)}`
                        : 'Bez dat'
                    }>
                      <div className="bg-emerald-500" style={{ width: pct(active) }} />
                      <div className="bg-gray-300" style={{ width: pct(idle) }} />
                      <div className="bg-slate-600" style={{ width: pct(locked) }} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {r?.topApp ? (
                      <span>
                        {r.topApp}
                        {categories[r.topApp] && (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            {categories[r.topApp]}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r ? Math.round(r.avgKpm) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r?.keystrokeTotal ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-emerald-500" /> Aktivní práce</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-300" /> Nečinnost</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-slate-600" /> Zamčeno</span>
        <span className="ml-auto">Časy v místním čase ({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
      </div>
    </div>
  );
}
