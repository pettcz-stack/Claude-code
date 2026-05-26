import { useEffect, useState } from 'react';
import { api, type Heatmap as HeatmapData } from './api.js';

const DAYS = [
  { idx: 1, label: 'Po' }, { idx: 2, label: 'Út' }, { idx: 3, label: 'St' },
  { idx: 4, label: 'Čt' }, { idx: 5, label: 'Pá' }, { idx: 6, label: 'So' }, { idx: 0, label: 'Ne' },
];

export function HeatmapView({ from, to, department, userId }: { from: string; to: string; department?: string; userId?: string }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  useEffect(() => { api.heatmap(from, to, { department, userId }).then(setData).catch(() => setData(null)); }, [from, to, department, userId]);
  if (!data) return null;
  const max = Math.max(data.max, 1);

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold">Kdy se pracuje (vytížení dne)</h3>
      <p className="mb-3 text-xs muted-2">
        <b>Barva</b> = poměr práce vs. zábavy v dané hodině (zelená = práce, červená = zábava).
        <b> Sytost</b> = jak aktivně byl uživatel u PC (bledé = málo aktivity, sytá = naplno).
        <b> Černá</b> v pracovní době (Po–Pá 8–16) = PC mlčí (možná HO bez práce nebo vypnuté PC).
      </p>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="text-[10px] font-normal muted-2" style={{ width: 22 }}>{h % 3 === 0 ? h : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d.idx}>
                <td className="pr-2 text-right text-xs muted">{d.label}</td>
                {Array.from({ length: 24 }, (_, h) => {
                  const total = data.matrix[d.idx]?.[h] ?? 0;
                  const work = data.work?.[d.idx]?.[h] ?? 0;
                  const nonwork = data.nonwork?.[d.idx]?.[h] ?? 0;
                  const classified = work + nonwork;
                  // intensity (0..1) podle celkové aktivity vs. max
                  const intensity = total / max;
                  // hue: zelená 145 = práce, červená 0 = zábava (~žlutá 60 = půl na půl)
                  const workRatio = classified > 0 ? work / classified : 0.5;
                  const hue = Math.round(workRatio * 145);
                  // lightness: 92 % = bledé (skoro bílé), 45 % = syté → bledé = málo aktivity
                  const lightness = Math.round(92 - 47 * intensity);
                  // Měl by pracovat? Po–Pá v 8–16 (klasické jádro pracovní doby).
                  const isWorkHour = d.idx >= 1 && d.idx <= 5 && h >= 8 && h < 17;
                  const noActivity = total === 0;
                  const bg = noActivity
                    ? (isWorkHour
                      ? '#111827'                  // černá = měl pracovat, ale PC mlčí (HO bez práce / vypnuté PC)
                      : 'rgba(148,163,184,0.18)')  // jiný čas = běžně mimo PC (večer, víkend)
                    : `hsl(${hue}, 80%, ${lightness}%)`;
                  const tip = noActivity
                    ? (isWorkHour
                      ? `${d.label} ${h}:00 – bez aktivity v pracovní době (PC vypnuté nebo mimo)`
                      : `${d.label} ${h}:00 – bez aktivity`)
                    : `${d.label} ${h}:00 – ${total} min aktivně\n  práce: ${work} min\n  zábava: ${nonwork} min`;
                  return (
                    <td key={h} title={tip}
                      style={{ width: 20, height: 18, borderRadius: 3, background: bg }} />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] muted-2">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(145,80%,45%)' }} /> sytá zelená = naplno pracoval</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(145,80%,80%)' }} /> bledá zelená = pracoval, ale málo</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(0,80%,55%)' }} /> sytá červená = naplno zábava</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsl(0,80%,85%)' }} /> bledá červená = chvíli zábava</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'rgba(148,163,184,0.30)' }} /> šedá = bez aktivity (mimo prac. dobu)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: '#111827' }} /> černá = měl pracovat (Po–Pá 8–16), ale PC mlčí</span>
      </div>
    </div>
  );
}
