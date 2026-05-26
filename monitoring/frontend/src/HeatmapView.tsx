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
                  // alpha: jak sytá – podle celkové aktivity vs. max
                  const intensity = total / max;
                  // hue: zelená 145 = práce, červená 0 = zábava
                  const workRatio = classified > 0 ? work / classified : 0.5;
                  const hue = Math.round(workRatio * 145); // 0=červená → 145=zelená
                  const alpha = 0.08 + 0.85 * intensity; // i málo aktivity je mírně viditelné
                  const bg = total === 0
                    ? 'rgba(148,163,184,0.10)' // úplně bez aktivity – šedá
                    : `hsla(${hue}, 70%, 45%, ${alpha.toFixed(2)})`;
                  const tip = total === 0
                    ? `${d.label} ${h}:00 – bez aktivity`
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
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsla(145,70%,45%,0.9)' }} /> sytá zelená = naplno pracoval</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsla(145,70%,45%,0.25)' }} /> bledá zelená = pracoval, ale málo</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'hsla(0,70%,45%,0.9)' }} /> sytá červená = naplno zábava</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: 'rgba(148,163,184,0.30)' }} /> šedá = bez aktivity</span>
      </div>
    </div>
  );
}
