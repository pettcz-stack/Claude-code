import { useEffect, useState } from 'react';
import { api, type HourlyRow, type User } from './api.js';
import { startOfLocalDay, minutesToHm, localHourOf, chipClass, TYPE_COLORS } from './util.js';
import { AppIcon, appName } from './appMeta.js';

type Props = { user: User; day: Date };

export function CalendarView({ user, day }: Props) {
  const [rows, setRows] = useState<HourlyRow[]>([]);
  const [appsByHour, setAppsByHour] = useState<Map<number, { app: string; minutes: number }[]>>(new Map());
  const [categories, setCategories] = useState<Record<string, { category: string; type: string }>>({});
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
    api.hourly(user.id, from.toISOString(), to.toISOString()).then(setRows).catch((e) => setError(String(e))).finally(() => setLoading(false));
    api.hourlyApps(user.id, from.toISOString(), to.toISOString()).then((hours) => {
      const m = new Map<number, { app: string; minutes: number }[]>();
      for (const h of hours) m.set(localHourOf(h.hourStart), h.apps);
      setAppsByHour(m);
    }).catch(() => setAppsByHour(new Map()));
  }, [user.id, day]);

  const byHour = new Map<number, HourlyRow>();
  for (const r of rows) byHour.set(localHourOf(r.hourStart), r);
  const totalActive = rows.reduce((s, r) => s + r.activeMinutes, 0);
  const totalIdle = rows.reduce((s, r) => s + r.idleMinutes, 0);

  return (
    <div className="card p-5">
      <div className="mb-3 flex gap-6 text-sm muted">
        <span>Aktivní celkem: <strong className="text-emerald-500">{minutesToHm(totalActive)}</strong></span>
        <span>Nečinnost: <strong>{minutesToHm(totalIdle)}</strong></span>
        {loading && <span className="text-blue-500">Načítám…</span>}
        {error && <span className="text-red-500">Chyba: {error}</span>}
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th className="th w-16">Hodina</th>
            <th className="th">Aktivita (z 60 min)</th>
            <th className="th w-56">Nejpoužívanější aplikace <span className="font-normal normal-case muted-2">(najeď myší pro rozpad)</span></th>
            <th className="th w-24 text-right">Tempo psaní (úhozů/min)</th>
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
            const cat = r?.topApp ? categories[r.topApp] : undefined;
            const apps = appsByHour.get(h) ?? [];
            return (
              <tr key={h} className="divide-row">
                <td className="td font-mono muted-2">{String(h).padStart(2, '0')}:00</td>
                <td className="td">
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700"
                    title={r ? `Aktivní ${minutesToHm(active)} · Nečinnost ${minutesToHm(idle)} · Zamčeno ${minutesToHm(locked)}` : 'Bez dat'}>
                    <div style={{ width: pct(active), background: TYPE_COLORS.work }} />
                    <div style={{ width: pct(idle), background: TYPE_COLORS.idle }} />
                    <div style={{ width: pct(locked), background: TYPE_COLORS.off }} />
                  </div>
                </td>
                <td className="td">
                  {r?.topApp ? (
                    <span className="group relative flex cursor-default items-center gap-2">
                      <AppIcon app={r.topApp} size={15} />
                      <span className="truncate">{appName(r.topApp)}</span>
                      {cat && <span className={chipClass(cat.type)}>{cat.category}</span>}
                      {apps.length > 0 && (
                        <div className="invisible absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg group-hover:visible dark:border-slate-700 dark:bg-slate-800">
                          <div className="mb-2 text-xs font-semibold">Použité aplikace v {String(h).padStart(2, '0')}:00 (aktivní čas)</div>
                          <div className="space-y-1">
                            {apps.map((a) => (
                              <div key={a.app} className="flex items-center justify-between gap-3 text-xs">
                                <span className="flex min-w-0 items-center gap-1.5"><AppIcon app={a.app} size={13} /> <span className="truncate">{appName(a.app)}</span></span>
                                <span className="shrink-0 tabular-nums muted">{minutesToHm(a.minutes)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </span>
                  ) : <span className="muted-2">—</span>}
                </td>
                <td className="td text-right tabular-nums">{r ? Math.round(r.avgKpm) : <span className="muted-2">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex gap-4 text-xs muted">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLORS.work }} /> Aktivní práce</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLORS.idle }} /> Nečinnost</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLORS.off }} /> Zamčeno</span>
        <span className="ml-auto muted-2">Místní čas ({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
      </div>
    </div>
  );
}
